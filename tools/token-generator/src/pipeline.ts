// Reads the canonical token files and produces every generated output in memory.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitBaseline, emitCss, emitTypes } from "./emit.ts";
import { emitRegistry, type IconSnapshot, iconIssues, iconSnapshotFile, iconsDocTable, lucideComponents, registryFile } from "./icons.ts";
import { type Issue, loadTokens, type Source, type Tier, type Token } from "./model.ts";
import { emitMotionTimings, emitReducedMotion, type MotionRegistry, motionDocTables, replaceGenerated } from "./motion.ts";
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
  motionTimings: "packages/keen/src/tokens/motion.ts",
  reducedMotion: "packages/keen/src/tokens/reduced-motion.css",
  registry: registryFile,
  motionDoc: "docs/foundations/motion.md",
  iconsDoc: "docs/foundations/icons.md",
} as const;

export const motionRegistryFile = "packages/keen/src/motion/registry.json";

// Inputs beyond the token files. Each is optional so token-only fixtures still generate.
export interface Extras {
  motionRegistry?: MotionRegistry;
  iconSnapshot?: IconSnapshot;
  lucide?: Set<string>;
  docs?: { motion?: string; icons?: string };
}

export function readExtras(root: string): Extras {
  const json = (file: string) => (existsSync(join(root, file)) ? JSON.parse(readFileSync(join(root, file), "utf8")) : undefined);
  const text = (file: string) => (existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : undefined);
  return {
    motionRegistry: json(motionRegistryFile),
    iconSnapshot: json(iconSnapshotFile),
    lucide: lucideComponents(root),
    docs: { motion: text(outputFiles.motionDoc), icons: text(outputFiles.iconsDoc) },
  };
}

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

export function generate(sources: Source[], extras: Extras = {}): Generation {
  const loaded = loadTokens(sources);
  const { resolved, issues } = resolveTokens(loaded.tokens);
  const snapshot = extras.iconSnapshot;
  const all = [...loaded.issues, ...issues, ...(snapshot && extras.lucide ? iconIssues(snapshot, extras.lucide) : [])];
  if (all.length > 0) return { tokens: loaded.tokens, resolved, issues: all, files: {} };
  const files: Record<string, string> = {
    [outputFiles.css]: emitCss(loaded.tokens),
    [outputFiles.types]: emitTypes(loaded.tokens),
    [outputFiles.baseline]: emitBaseline(resolved),
    [outputFiles.motionTimings]: emitMotionTimings(loaded.tokens, resolved),
    [outputFiles.reducedMotion]: emitReducedMotion(loaded.tokens, extras.motionRegistry ?? { loops: [], entrances: [] }),
  };
  if (snapshot) files[outputFiles.registry] = emitRegistry(snapshot);
  if (extras.docs?.motion) files[outputFiles.motionDoc] = replaceGenerated(extras.docs.motion, motionDocTables(loaded.tokens, resolved));
  if (extras.docs?.icons && snapshot) files[outputFiles.iconsDoc] = replaceGenerated(extras.docs.icons, iconsDocTable(snapshot));
  return { tokens: loaded.tokens, resolved, issues: all, files };
}

export const formatIssue = (issue: Issue) => `${issue.token} [${issue.rule}]: ${issue.message}`;
