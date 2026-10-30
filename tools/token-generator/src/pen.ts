// Writes the token variables into design/keen.pen and walks its layers. The design agent lays out the file; the
// variables block is generated, so a token change reaches the design the same way it reaches the CSS.
import { compareTokens, emitsVariable } from "./emit.ts";
import { type Issue, isReference, modes, referenceName, type Token } from "./model.ts";
import type { Resolved } from "./resolve.ts";

const penTypes: Record<string, string> = {
  color: "color",
  dimension: "number",
  number: "number",
  fontFamily: "string",
  fontWeight: "string",
};

export type PenValue = string | number;
export type PenVariable = { type: string; value: PenValue | { value: PenValue; theme: { mode: string } }[] };

// Pen holds a color as hex, a dimension as px, a font family as its primary family, and a weight as a string.
function penValue(token: Token, value: unknown): PenValue {
  switch (token.type) {
    case "color":
      return (value as { hex: string }).hex;
    case "dimension": {
      const v = value as { value: number; unit: string };
      return v.unit === "px" ? v.value : `has unit ${v.unit}; Pen variables hold px only`;
    }
    case "fontFamily":
      return ([] as string[]).concat(value as string | string[])[0];
    case "fontWeight":
      return String(value);
    default:
      return value as number;
  }
}

export function emitPenVariables(
  tokens: Token[],
  resolved: Map<string, Resolved>,
): { variables: Record<string, PenVariable>; issues: Issue[] } {
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const variables: Record<string, PenVariable> = {};
  const issues: Issue[] = [];
  const designed = tokens.filter((t) => t.tier !== "primitive" && emitsVariable(t) && penTypes[t.type]).sort(compareTokens);
  for (const token of designed) {
    const type = penTypes[token.type];
    // A token that only aliases another designed token stays an alias, so the design keeps the relationship.
    const authored = token.values.light;
    const target = isReference(authored) ? byName.get(referenceName(authored)) : undefined;
    if (target && target.tier !== "primitive" && Object.keys(token.values).length === 1) {
      variables[token.name] = { type, value: `$${target.name}` };
      continue;
    }
    const values = modes.map((mode) => penValue(token, resolved.get(token.name)?.modes[mode].value));
    const problem = token.type === "dimension" ? values.find((v) => typeof v === "string") : undefined;
    if (problem !== undefined) {
      issues.push({ rule: "pen", token: token.name, message: String(problem) });
      continue;
    }
    variables[token.name] = values.every((v) => v === values[0])
      ? { type, value: values[0] }
      : { type, value: values.map((value, i) => ({ value, theme: { mode: modes[i] } })) };
  }
  return { variables, issues };
}

// Replaces the variables block and keeps everything else, in Pen's own formatting: two-space JSON, no final newline.
export function emitPen(design: string, variables: Record<string, PenVariable>): string {
  const pen = JSON.parse(design);
  pen.variables = variables;
  return JSON.stringify(pen, null, 2);
}

export type PenNode = Record<string, unknown> & { type?: string; id?: string; name?: string; children?: PenNode[] };

// Every layer in the file, depth first, with its ancestors. The variables and themes blocks are not layers.
export function* layers(pen: { children?: PenNode[] }): Generator<{ node: PenNode; ancestors: PenNode[] }> {
  function* walk(node: PenNode, ancestors: PenNode[]): Generator<{ node: PenNode; ancestors: PenNode[] }> {
    yield { node, ancestors };
    for (const child of node.children ?? []) yield* walk(child, [...ancestors, node]);
  }
  for (const child of pen.children ?? []) yield* walk(child, []);
}

// The layer path a person can find in Pen, such as "State 03 · streaming · dark > Chat > Message log".
export const layerPath = (node: PenNode, ancestors: PenNode[]) => [...ancestors, node].map((n) => n.name ?? n.id).join(" > ");
