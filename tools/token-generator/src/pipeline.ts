// Reads the canonical token files and produces every generated output in memory.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitBaseline, emitCss, emitTypes } from "./emit.ts";
import {
  emitRegistry,
  iconIssues,
  iconSnapshotFile,
  iconsDocTable,
  iconsFromDesign,
  lucideComponents,
  registryFile,
  serializeSnapshot,
} from "./icons.ts";
import { type Issue, loadTokens, type Source, type Tier, type Token } from "./model.ts";
import { emitMotionTimings, emitReducedMotion, type MotionRegistry, motionDocTables, replaceGenerated } from "./motion.ts";
import { emitPen, emitPenVariables, penVersionIssues } from "./pen.ts";
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
  motionTimings: "packages/keen/src/tokens/motion.ts",
  reducedMotion: "packages/keen/src/tokens/reduced-motion.css",
  registry: registryFile,
  motionDoc: "docs/foundations/motion.md",
  iconsDoc: "docs/foundations/icons.md",
  // The design agent owns the layers; the generator owns the variables block and the icon snapshot read from it.
  pen: "design/keen.pen",
  icons: iconSnapshotFile,
} as const;

export const motionRegistryFile = "packages/keen/src/motion/registry.json";

// Inputs beyond the token files. Each is optional so token-only fixtures still generate.
export interface Extras {
  // The text of design/keen.pen. Its layers are input; its variables and icon snapshot are output.
  design?: string;
  motionRegistry?: MotionRegistry;
  lucide?: Set<string>;
  docs?: { motion?: string; icons?: string };
}

export function readExtras(root: string): Extras {
  const text = (file: string) => (existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : undefined);
  const json = (file: string) => {
    const content = text(file);
    return content === undefined ? undefined : JSON.parse(content);
  };
  return {
    design: text(outputFiles.pen),
    motionRegistry: json(motionRegistryFile),
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
  const versionIssues = extras.design === undefined ? [] : penVersionIssues(extras.design, outputFiles.pen);
  if (versionIssues.length > 0) return { tokens: loaded.tokens, resolved, issues: versionIssues, files: {} };
  const snapshot = extras.design === undefined ? undefined : iconsFromDesign(extras.design, outputFiles.pen);
  const all = [...loaded.issues, ...issues, ...(snapshot && extras.lucide ? iconIssues(snapshot, extras.lucide) : [])];
  if (all.length > 0) return { tokens: loaded.tokens, resolved, issues: all, files: {} };
  const pen = emitPenVariables(loaded.tokens, resolved);
  if (pen.issues.length > 0) return { tokens: loaded.tokens, resolved, issues: pen.issues, files: {} };
  // Canvas tokens color the design file only, so they stay out of the stylesheet, the typed map, and the baseline.
  const product = loaded.tokens.filter((t) => t.tier !== "canvas");
  const files: Record<string, string> = {
    [outputFiles.css]: emitCss(product),
    [outputFiles.types]: emitTypes(product),
    [outputFiles.baseline]: emitBaseline(new Map([...resolved].filter(([, r]) => r.token.tier !== "canvas"))),
    [outputFiles.motionTimings]: emitMotionTimings(product, resolved),
    [outputFiles.reducedMotion]: emitReducedMotion(product, extras.motionRegistry ?? { loops: [], entrances: [] }),
  };
  if (extras.design !== undefined) files[outputFiles.pen] = emitPen(extras.design, pen.variables);
  if (snapshot) {
    files[outputFiles.icons] = serializeSnapshot(snapshot);
    files[outputFiles.registry] = emitRegistry(snapshot);
  }
  if (extras.docs?.motion) files[outputFiles.motionDoc] = replaceGenerated(extras.docs.motion, motionDocTables(product, resolved));
  if (extras.docs?.icons && snapshot) files[outputFiles.iconsDoc] = replaceGenerated(extras.docs.icons, iconsDocTable(snapshot));
  return { tokens: loaded.tokens, resolved, issues: [], files };
}

export const formatIssue = (issue: Issue) => `${issue.token} [${issue.rule}]: ${issue.message}`;
