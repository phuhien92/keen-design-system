// Reads the canonical token files and produces every generated output in memory.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitBaseline, emitCss, emitTypes } from "./emit.ts";
import { type Issue, loadTokens, type Source, type Tier, type Token } from "./model.ts";
import { type Resolved, resolveTokens } from "./resolve.ts";

export const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export const sourceFiles: { file: string; tier: Tier }[] = [
  { file: "tokens/primitive.json", tier: "primitive" },
  { file: "tokens/semantic.json", tier: "semantic" },
  { file: "tokens/component.json", tier: "component" },
];

export const outputFiles = {
  css: "packages/keen/src/tokens/tokens.css",
  types: "packages/keen/src/tokens/tokens.ts",
  baseline: ".keen/baselines/tokens.json",
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

export function generate(sources: Source[]): Generation {
  const loaded = loadTokens(sources);
  const { resolved, issues } = resolveTokens(loaded.tokens);
  const all = [...loaded.issues, ...issues];
  const files: Record<string, string> =
    all.length > 0
      ? {}
      : {
          [outputFiles.css]: emitCss(loaded.tokens),
          [outputFiles.types]: emitTypes(loaded.tokens),
          [outputFiles.baseline]: emitBaseline(resolved),
        };
  return { tokens: loaded.tokens, resolved, issues: all, files };
}

export const formatIssue = (issue: Issue) => `${issue.token} [${issue.rule}]: ${issue.message}`;
