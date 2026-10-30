// Motion outputs: the scoped reduced-motion stylesheet, JavaScript timings, and the motion doc's role and use tables.
import { compareTokens, formatValue } from "./emit.ts";
import { cssVar, type Token } from "./model.ts";
import type { Resolved } from "./resolve.ts";

// Keen's root element. Reduced-motion rules are scoped under it, never :root or * on the host page.
export const keenRoot = "[data-keen-root]";
export const reducedDuration = "0.01ms";

// packages/keen/src/motion/registry.json: every looping and entrance animation a component declares.
export interface MotionRegistry {
  loops: { keyframes: string; selector: string; frame: Record<string, string> }[];
  entrances: { keyframes: string; selector: string }[];
}

export const semanticDurations = (tokens: Token[]) =>
  tokens.filter((t) => t.tier === "semantic" && t.type === "duration").sort(compareTokens);

export const namedUses = (tokens: Token[]) => tokens.filter((t) => t.type === "transition").sort(compareTokens);

const ref = (value: unknown) => (typeof value === "string" ? value.slice(1, -1) : undefined);

// Each named use as the duration and easing variables a component must apply together.
export function useVariables(tokens: Token[]): Map<string, { duration: string; easing: string }> {
  return new Map(
    namedUses(tokens).map((t) => {
      const value = t.values.light as { duration: unknown; timingFunction: unknown };
      return [t.name, { duration: cssVar(ref(value.duration) ?? ""), easing: cssVar(ref(value.timingFunction) ?? "") }];
    }),
  );
}

export function emitReducedMotion(tokens: Token[], registry: MotionRegistry): string {
  const rule = (selector: string, body: string[]) => `  ${selector} {\n${body.map((line) => `    ${line}\n`).join("")}  }\n`;
  const blocks = [
    rule(
      keenRoot,
      semanticDurations(tokens).map((t) => `${cssVar(t.name)}: ${reducedDuration};`),
    ),
    rule(`${keenRoot},\n  ${keenRoot} *`, ["scroll-behavior: auto;"]),
    ...registry.loops.map((loop) =>
      rule(`${keenRoot} ${loop.selector}`, ["animation: none;", ...Object.entries(loop.frame).map(([p, v]) => `${p}: ${v};`)]),
    ),
    ...registry.entrances.map((entrance) => rule(`${keenRoot} ${entrance.selector}`, ["animation: none;"])),
  ];
  return [
    "/* Generated from tokens/*.json and packages/keen/src/motion/registry.json by tools/token-generator. Do not edit. */",
    `/* Declared last in styles.css and scoped to Keen's root, so reduced motion never reaches the host page. */`,
    "",
    "@media (prefers-reduced-motion: reduce) {",
    blocks.join("\n").trimEnd(),
    "}",
    "",
  ].join("\n");
}

const toMs = (value: unknown) => {
  const v = value as { value: number; unit: string };
  return v.unit === "s" ? v.value * 1000 : v.value;
};

export function emitMotionTimings(tokens: Token[], resolved: Map<string, Resolved>): string {
  const timed = semanticDurations(tokens).filter((t) => t.keen.js);
  const lines = timed.map((t) => {
    const key = t.path[t.path.length - 1];
    return `  ${JSON.stringify(key)}: { ms: ${toMs(resolved.get(t.name)?.modes.light.value)}, kind: ${JSON.stringify(t.keen.js)} },`;
  });
  return [
    "// Generated from tokens/*.json by tools/token-generator. Do not edit; run pnpm tokens:build.",
    "// Motion durations that JavaScript timers use. schedule: when something starts or is removed; reduced motion leaves",
    "// it alone. pace: an animation rate; the component checks reduced motion and skips the animation.",
    "export const motionTimings = {",
    ...lines,
    "} as const;",
    "",
    "export type MotionTiming = keyof typeof motionTimings;",
    "",
  ].join("\n");
}

export function motionDocTables(tokens: Token[], resolved: Map<string, Resolved>): string {
  const value = (t: Token) => formatValue(t.type, resolved.get(t.name)?.modes.light.value);
  const roles = tokens.filter((t) => t.tier === "semantic" && (t.type === "duration" || t.type === "cubicBezier")).sort(compareTokens);
  const rows = roles.map((t) => `| \`${t.name}\` | ${value(t)} | ${t.keen.js ?? ""} | ${t.description ?? ""} |`);
  const uses = namedUses(tokens).map((t) => {
    const v = t.values.light as { duration: string; timingFunction: string };
    return `| \`${t.name}\` | \`${ref(v.duration)}\` | \`${ref(v.timingFunction)}\` | ${t.description ?? ""} |`;
  });
  return [
    "| Role | Value | JavaScript | Intended use |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "| Use | Duration | Easing | Intended use |",
    "| --- | --- | --- | --- |",
    ...uses,
  ].join("\n");
}

// Replaces the text between a doc's generated markers.
export function replaceGenerated(doc: string, content: string): string {
  const start = "<!-- generated:start -->";
  const end = "<!-- generated:end -->";
  const i = doc.indexOf(start);
  const j = doc.indexOf(end);
  if (i < 0 || j < i) throw new Error(`missing ${start} and ${end} markers`);
  return `${doc.slice(0, i + start.length)}\n${content}\n${doc.slice(j)}`;
}
