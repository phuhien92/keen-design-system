// Generates the Pen document variables from the DTCG tokens, and reads and writes them through the Pen CLI.
import { spawnSync } from "node:child_process";
import { compareTokens } from "./emit.ts";
import { isReference, modes, referenceName, type Token } from "./model.ts";

export interface PenVariable {
  type: "color" | "number" | "string";
  value: unknown;
}

export interface PenVariables {
  themes: Record<string, string[]>;
  variables: Record<string, PenVariable>;
}

// Pen has color, number, and string variables. Motion tokens have no Pen equivalent and stay out of the design.
const penTypes: Record<string, PenVariable["type"]> = {
  color: "color",
  dimension: "number",
  number: "number",
  fontFamily: "string",
  fontWeight: "string",
};

function penValue(type: string, authored: unknown): unknown {
  if (isReference(authored)) return `$${referenceName(authored)}`;
  switch (type) {
    case "color":
      return (authored as { hex: string }).hex;
    case "dimension": {
      const { value, unit } = authored as { value: number; unit: string };
      return unit === "rem" ? value * 16 : value;
    }
    case "fontFamily":
      return ([] as string[]).concat(authored as string | string[])[0];
    case "fontWeight":
      return String(authored);
    default:
      return authored;
  }
}

export function penVariables(tokens: Token[]): PenVariables {
  const variables: Record<string, PenVariable> = {};
  for (const token of [...tokens].sort(compareTokens)) {
    const type = penTypes[token.type];
    if (!type) continue;
    const themed = modes.some((mode) => token.values[mode] !== undefined && mode !== "light");
    variables[token.name] = {
      type,
      value: themed
        ? modes.map((mode) => ({ value: penValue(token.type, token.values[mode] ?? token.values.light), theme: { mode } }))
        : penValue(token.type, token.values.light),
    };
  }
  return { themes: { mode: [...modes] }, variables };
}

// Pen returns object keys in its own order; compare and store variables in token order.
export function normalize(pen: PenVariables, order: string[]): PenVariables {
  const rank = new Map(order.map((name, i) => [name, i]));
  const names = Object.keys(pen.variables).sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9) || (a < b ? -1 : 1));
  return { themes: pen.themes ?? {}, variables: Object.fromEntries(names.map((n) => [n, pen.variables[n]])) };
}

export type PenResult = { ok: true; value: unknown } | { ok: false; error: string; unavailable: boolean };

// Runs one headless Pen session on a design file. The snippet must call Emit(value) once; save writes the file back.
export function runPen(design: string, snippet: string, save: boolean): PenResult {
  const input = `Emit=(v)=>Print("KEEN<<"+JSON.stringify(v)+">>KEEN");${snippet}`;
  const script = [`execute({ input: ${JSON.stringify(input)} })`, ...(save ? ["save()"] : []), "exit()"].join("\n");
  const result = spawnSync("pen", ["interactive", "--in", design, "--out", design], { input: `${script}\n`, encoding: "utf8" });
  if (result.error) return { ok: false, unavailable: true, error: `the pen CLI is not installed (${result.error.message})` };
  const output = `${result.stdout}${result.stderr}`;
  if (/Authentication required/.test(output))
    return { ok: false, unavailable: true, error: "the pen CLI is not signed in (pen login or PEN_CLI_KEY)" };
  const match = output.match(/KEEN<<([\s\S]*?)>>KEEN/);
  if (result.status !== 0 || !match) return { ok: false, unavailable: false, error: output.trim().split("\n").slice(-6).join("\n") };
  return { ok: true, value: JSON.parse(match[1]) };
}

export const readPenVariables = (design: string) => runPen(design, "Emit(GetVariables())", false);

export const writePenVariables = (design: string, pen: PenVariables) =>
  runPen(design, `SetVariables(${JSON.stringify(pen.variables)}, true);Emit(GetVariables())`, true);

export const designFile = "design/keen.pen";
export const variablesFile = "design/keen.variables.json";

// design/keen.variables.json: the Pen variables read back from design/keen.pen after pnpm design:push.
export const serializeVariables = (pen: PenVariables) =>
  `${JSON.stringify({ generatedFrom: "tokens/*.json by pnpm design:push, read back from design/keen.pen", ...pen }, null, 2)}\n`;
