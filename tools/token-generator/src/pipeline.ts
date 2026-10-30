// Reads the canonical token files and produces every generated output in memory.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitBaseline, emitCss, emitTypes } from "./emit.ts";
import { type Issue, loadTokens, type Source, type Tier, type Token } from "./model.ts";
import { emitPen, emitPenVariables } from "./pen.ts";
import { type Resolved, resolveTokens } from "./resolve.ts";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export const sourceFiles: { file: string; tier: Tier }[] = [
  { file: "tokens/primitive.json", tier: "primitive" },
  { file: "tokens/semantic.json", tier: "semantic" },
  { file: "tokens/component.json", tier: "component" },
  { file: "design/canvas.json", tier: "canvas" },
];

export const outputFiles = {
  css: "packages/keen/src/tokens/tokens.css",
  types: "packages/keen/src/tokens/tokens.ts",
  baseline: ".keen/baselines/tokens.json",
  // The design agent owns the layers; the generator owns the variables block.
  pen: "design/keen.pen",
} as const;

export interface Generation {
  tokens: Token[];
  resolved: Map<string, Resolved>;
  issues: Issue[];
  // Output path (relative to the repo root) to file contents. Empty when the sources have issues.
  files: Record<string, string>;
}

export function readSources(root: string): Source[] {
  return sourceFiles.map(({ file, tier }) => ({ file, tier, json: JSON.parse(readFileSync(join(root, file), "utf8")) }));
}

export function readDesign(root: string): string | undefined {
  const file = join(root, outputFiles.pen);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

export function generate(sources: Source[], design?: string): Generation {
  const loaded = loadTokens(sources);
  const { resolved, issues } = resolveTokens(loaded.tokens);
  const all = [...loaded.issues, ...issues];
  if (all.length > 0) return { tokens: loaded.tokens, resolved, issues: all, files: {} };
  const pen = emitPenVariables(loaded.tokens, resolved);
  if (pen.issues.length > 0) return { tokens: loaded.tokens, resolved, issues: pen.issues, files: {} };
  // Canvas tokens color the design file only, so they stay out of the stylesheet, the typed map, and the baseline.
  const product = loaded.tokens.filter((t) => t.tier !== "canvas");
  const files: Record<string, string> = {
    [outputFiles.css]: emitCss(product),
    [outputFiles.types]: emitTypes(product),
    [outputFiles.baseline]: emitBaseline(new Map([...resolved].filter(([, r]) => r.token.tier !== "canvas"))),
  };
  if (design !== undefined) files[outputFiles.pen] = emitPen(design, pen.variables);
  return { tokens: loaded.tokens, resolved, issues: [], files };
}

export const formatIssue = (issue: Issue) => `${issue.token} [${issue.rule}]: ${issue.message}`;
