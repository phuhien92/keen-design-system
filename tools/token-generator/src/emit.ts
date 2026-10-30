// Turns resolved tokens into the generated outputs: CSS custom properties, the typed token map, and the baseline.
import { cssVar, isReference, modes, referenceName, type Tier, type Token } from "./model.ts";
import type { Resolved } from "./resolve.ts";

export const cssHeader = "/* Generated from tokens/*.json by tools/token-generator. Do not edit; run pnpm tokens:build. */\n";
export const tsHeader = "// Generated from tokens/*.json by tools/token-generator. Do not edit; run pnpm tokens:build.\n";

const tierOrder: Record<Tier, number> = { primitive: 0, semantic: 1, component: 2 };
const genericFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
]);

// Orders tokens by tier, then by path with numeric-aware segment comparison, so output never depends on authoring order.
export function compareTokens(a: Token, b: Token): number {
  if (a.tier !== b.tier) return tierOrder[a.tier] - tierOrder[b.tier];
  const left = a.name.split(/(\d+)/);
  const right = b.name.split(/(\d+)/);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] === right[i]) continue;
    const numeric = i % 2 === 1;
    return numeric ? Number(left[i]) - Number(right[i]) : left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}

// Whether a token is a CSS custom property a consumer can read. Transitions are composites expanded where used.
export const emitsVariable = (token: Token) => token.type !== "transition";

export function formatValue(type: string, value: unknown): string {
  switch (type) {
    case "color":
      return (value as { hex: string }).hex;
    case "dimension":
    case "duration": {
      const v = value as { value: number; unit: string };
      return `${v.value}${v.unit}`;
    }
    case "fontFamily":
      return ([] as string[])
        .concat(value as string | string[])
        .map((f) => (genericFamilies.has(f) ? f : JSON.stringify(f)))
        .join(", ");
    case "cubicBezier": {
      const curve = (value as number[]).join(", ");
      if (curve === "0, 0, 1, 1") return "linear";
      if (curve === "0.25, 0.1, 0.25, 1") return "ease";
      return `cubic-bezier(${curve})`;
    }
    default:
      return String(value);
  }
}

const declaration = (token: Token, authored: unknown) =>
  `  ${cssVar(token.name)}: ${isReference(authored) ? `var(${cssVar(referenceName(authored))})` : formatValue(token.type, authored)};\n`;

// A custom property resolves its var() where it is declared, so a token that references a mode-dependent token
// must be declared again in every mode's block, or a mode set below :root would keep the page's value.
const dependsOnModes = (token: Token, byName: Map<string, Token>): boolean => {
  if (modes.some((mode) => mode !== "light" && token.values[mode] !== undefined)) return true;
  const authored = token.values.light;
  const target = isReference(authored) ? byName.get(referenceName(authored)) : undefined;
  return target ? dependsOnModes(target, byName) : false;
};

const themingNote =
  "/* Hosts theme Keen page-wide: override semantic and component tokens on :root and on [data-keen-mode] selectors.\n   Overrides scoped to any other subtree do not reach the tokens that alias them; subtree theming is not supported yet. */\n";

export function emitCss(tokens: Token[]): string {
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const sorted = tokens.filter(emitsVariable).sort(compareTokens);
  let css = `${cssHeader}${themingNote}\n:root {\n`;
  for (const token of sorted) css += declaration(token, token.values.light);
  css += "}\n";
  const themed = sorted.filter((t) => dependsOnModes(t, byName));
  if (themed.length === 0) return css;
  for (const mode of modes) {
    css += `\n[data-keen-mode="${mode}"] {\n`;
    for (const token of themed) css += declaration(token, token.values[mode] ?? token.values.light);
    css += "}\n";
  }
  return css;
}

type Tree = { [key: string]: Tree | string };

export function emitTypes(tokens: Token[]): string {
  const tree: Tree = {};
  for (const token of tokens.filter((t) => t.tier !== "primitive" && emitsVariable(t)).sort(compareTokens)) {
    let node = tree;
    for (const part of token.path.slice(0, -1)) {
      node[part] ??= {};
      node = node[part] as Tree;
    }
    node[token.path[token.path.length - 1]] = `var(${cssVar(token.name)})`;
  }
  const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  const print = (node: Tree, depth: number): string => {
    const pad = "  ".repeat(depth + 1);
    const lines = Object.entries(node).map(
      ([k, v]) => `${pad}${key(k)}: ${typeof v === "string" ? JSON.stringify(v) : print(v, depth + 1)},`,
    );
    return `{\n${lines.join("\n")}\n${"  ".repeat(depth)}}`;
  };
  return `${tsHeader}// Semantic and component tokens only: primitives are not part of the typed API.\n// Host overrides are page-level (:root and [data-keen-mode] selectors); subtree theming is not supported yet.\nexport const keenTokens = ${print(tree, 0)} as const;\n\nexport type KeenTokens = typeof keenTokens;\n`;
}

const formatResolved = (type: string, value: unknown): unknown => {
  if (value === undefined) return null;
  if (type === "transition") {
    const v = value as Record<string, unknown>;
    return {
      duration: formatResolved("duration", v.duration),
      delay: formatResolved("duration", v.delay),
      timingFunction: formatResolved("cubicBezier", v.timingFunction),
    };
  }
  return formatValue(type, value);
};

export function emitBaseline(resolved: Map<string, Resolved>): string {
  const entries = [...resolved.values()]
    .sort((a, b) => compareTokens(a.token, b.token))
    .map(({ token, modes: values }) => ({
      name: token.name,
      cssVar: emitsVariable(token) ? cssVar(token.name) : null,
      tier: token.tier,
      type: token.type,
      ...Object.fromEntries(
        modes.map((mode) => [mode, { reference: values[mode].reference ?? null, value: formatResolved(token.type, values[mode].value) }]),
      ),
    }));
  return `${JSON.stringify({ generatedFrom: "tokens/*.json", tokens: entries }, null, 2)}\n`;
}
