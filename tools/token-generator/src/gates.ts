// The verification gates named in .keen/gates.json. Each gate passes, fails with reasons, or is skipped with a reason.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkContracts, checkForwarding, checkReads, componentSources, type TokenIndex } from "./boundary.ts";
import { type Contract, checkContract } from "./contract.ts";
import { type ContrastPair, checkContrast } from "./contrast.ts";
import { checkDesignAnatomy, checkDesignVariables } from "./design.ts";
import { emitsVariable } from "./emit.ts";
import { type IconSnapshot, iconSnapshotFile, readDesignIcons, registryFile } from "./icons.ts";
import {
  checkHostMotion,
  checkReducedMotion as checkLiveReducedMotion,
  checkStorybookBuild,
  checkTokenSample,
  fixtureDist,
  type LiveResult,
  storybookDir,
  withPage,
} from "./live.ts";
import { cssVar } from "./model.ts";
import { type MotionRegistry, semanticDurations, useVariables } from "./motion.ts";
import { checkAllowDirectives, checkIconUsage, checkMotionUsage, checkReducedMotion } from "./motion-checks.ts";
import { checkFixture, checkPackage } from "./package.ts";
import { differingVariables, type PenVariable, readPenVariables } from "./pen.ts";
import { formatIssue, type Generation, generate, motionRegistryFile, outputFiles, readExtras, readSources } from "./pipeline.ts";

export type Tier = "fast" | "build" | "live";
export type GateResult = { status: "pass"; notes?: string[] } | { status: "fail"; reasons: string[] } | { status: "skip"; reason: string };

export interface Context {
  root: string;
  generation: () => Generation;
}

const pass: GateResult = { status: "pass" };
const result = (reasons: string[]): GateResult => (reasons.length > 0 ? { status: "fail", reasons } : pass);
const tokenIndex = (ctx: Context): TokenIndex => ({
  vars: new Map(
    ctx
      .generation()
      .tokens.filter(emitsVariable)
      .map((t) => [cssVar(t.name), t.name]),
  ),
});
const motionRegistry = (root: string): MotionRegistry => JSON.parse(read(root, motionRegistryFile) ?? '{ "loops": [], "entrances": [] }');
const snapshotOf = (root: string): IconSnapshot | undefined => {
  const text = read(root, iconSnapshotFile);
  return text ? JSON.parse(text) : undefined;
};
const live = (outcome: LiveResult): GateResult => ("skip" in outcome ? { status: "skip", reason: outcome.skip } : result(outcome.failures));
const read = (root: string, file: string) => (existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : undefined);

export const gates: Record<string, (ctx: Context) => GateResult | Promise<GateResult>> = {
  "tokens-valid": (ctx) => result(ctx.generation().issues.map(formatIssue)),

  "tokens-generated": (ctx) => {
    const first = ctx.generation();
    if (first.issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const second = generate(readSources(ctx.root), readExtras(ctx.root));
    const reasons: string[] = [];
    for (const [file, content] of Object.entries(first.files)) {
      if (file === outputFiles.baseline) continue;
      if (second.files[file] !== content) reasons.push(`${file} is not deterministic: two generations differ`);
      if (read(ctx.root, file) !== content) reasons.push(`${file} is stale or hand-edited; run pnpm tokens:build`);
    }
    return result(reasons);
  },

  "tokens-baseline": (ctx) => {
    const { files, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const committed = read(ctx.root, outputFiles.baseline);
    if (committed === files[outputFiles.baseline]) return pass;
    return {
      status: "fail",
      reasons: [
        `${outputFiles.baseline} does not match the token sources; run pnpm tokens:build and review the baseline diff with the token change`,
      ],
    };
  },

  "tokens-contrast": (ctx) => {
    const { resolved, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const check = ({ file, json }: ContractFile) => checkContrast((json.contrast ?? []) as ContrastPair[], resolved, file);
    return result(readContracts(ctx.root).flatMap(check));
  },

  "tokens-contract": (ctx) => {
    const { resolved, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const check = ({ file, json }: ContractFile) => checkContract(json as unknown as Contract, resolved, file);
    return result(readContracts(ctx.root).flatMap(check));
  },

  "design-variables": (ctx) => {
    const { files, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const pen = files[outputFiles.pen];
    if (pen === undefined) return { status: "skip", reason: `${outputFiles.pen} does not exist` };
    return result(checkDesignVariables(JSON.parse(pen)).map((failure) => `${outputFiles.pen}: ${failure}`));
  },

  "design-anatomy": (ctx) => {
    const { files, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const pen = files[outputFiles.pen];
    if (pen === undefined) return { status: "skip", reason: `${outputFiles.pen} does not exist` };
    const contracts = readContracts(ctx.root).map(({ file, json }) => ({ file, contract: json as unknown as Contract }));
    // A failure about a contract already names its file; one about a layer is located in the design file.
    const located = (failure: string) =>
      contracts.some((c) => failure.startsWith(`${c.file}:`)) ? failure : `${outputFiles.pen}: ${failure}`;
    return result(checkDesignAnatomy(JSON.parse(pen), contracts).map(located));
  },

  // tokens:build writes the variables into design/keen.pen; this confirms Pen itself reads them back unchanged.
  "pen-live": (ctx) => {
    const { files, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const generated = files[outputFiles.pen];
    if (generated === undefined) return { status: "skip", reason: `${outputFiles.pen} does not exist` };
    const live = readPenVariables(join(ctx.root, outputFiles.pen));
    if (!live.ok) return live.unavailable ? { status: "skip", reason: live.error } : { status: "fail", reasons: [live.error] };
    const expected: Record<string, PenVariable> = JSON.parse(generated).variables;
    const differing = differingVariables((live.value as { variables: Record<string, PenVariable> }).variables ?? {}, expected);
    if (differing.length === 0) return pass;
    return {
      status: "fail",
      reasons: [`Pen reads different variables from ${outputFiles.pen}: ${differing.join(", ")}; run pnpm tokens:build`],
    };
  },

  "component-forwarding": (ctx) => result(checkForwarding(componentSources(ctx.root))),

  "token-reads": (ctx) => {
    const index = tokenIndex(ctx);
    const { failures, read: reads } = checkReads(componentSources(ctx.root), index);
    if (failures.length > 0) return { status: "fail", reasons: failures };
    const unused = [...index.vars].filter(([name, token]) => !reads.has(name) && !token.includes(".primitive.")).map(([, token]) => token);
    return {
      status: "pass",
      notes: unused.length > 0 ? [`${unused.length} semantic or component tokens are not read by component code yet`] : [],
    };
  },

  "contract-roles": (ctx) => result(checkContracts(componentSources(ctx.root), tokenIndex(ctx), ctx.root)),

  "motion-usage": (ctx) =>
    result(checkMotionUsage(componentSources(ctx.root), useVariables(ctx.generation().tokens), motionRegistry(ctx.root))),

  "reduced-motion": (ctx) => {
    const durations = semanticDurations(ctx.generation().tokens).map((t) => cssVar(t.name));
    return result(
      checkReducedMotion(read(ctx.root, outputFiles.reducedMotion), durations, motionRegistry(ctx.root), componentSources(ctx.root)),
    );
  },

  "motion-timings": (ctx) => {
    const { tokens, resolved, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const committed = read(ctx.root, outputFiles.motionTimings) ?? "";
    const entries = new Map(
      [...committed.matchAll(/"([\w-]+)": \{ ms: (\d+(?:\.\d+)?), kind: "(\w+)" \}/g)].map((m) => [m[1], `${m[2]} ${m[3]}`]),
    );
    const reasons: string[] = [];
    for (const token of semanticDurations(tokens).filter((t) => t.keen.js)) {
      const key = token.path[token.path.length - 1];
      const value = resolved.get(token.name)?.modes.light.value as { value: number; unit: string };
      const expected = `${value.unit === "s" ? value.value * 1000 : value.value} ${token.keen.js}`;
      if (entries.get(key) !== expected) reasons.push(`motion.ts ${key} is ${entries.get(key) ?? "missing"}; the token says ${expected}`);
    }
    const baseline = read(ctx.root, outputFiles.baseline) ?? "";
    for (const name of ["motion.semantic.duration-fast", "motion.semantic.use-hover", "icon.semantic.size-md"]) {
      if (!baseline.includes(`"name": "${name}"`)) reasons.push(`the token baseline does not record ${name}`);
    }
    return result(reasons);
  },

  "ds-allow": (ctx) => result(checkAllowDirectives(componentSources(ctx.root))),

  // tokens:build reads the icon nodes from design/keen.pen; this confirms Pen itself sees the same icons.
  "icons-live": (ctx) => {
    const { files, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const generated = files[outputFiles.icons];
    if (generated === undefined) return { status: "skip", reason: `${outputFiles.pen} does not exist` };
    const snapshot: IconSnapshot = JSON.parse(generated);
    const live = readDesignIcons(ctx.root, snapshot.design);
    if (!live.ok) return live.unavailable ? { status: "skip", reason: live.error } : { status: "fail", reasons: [live.error] };
    if (JSON.stringify(live.snapshot.glyphs) === JSON.stringify(snapshot.glyphs)) return pass;
    return { status: "fail", reasons: [`Pen reads different icon nodes from ${snapshot.design} than ${iconSnapshotFile} records`] };
  },

  "icon-usage": (ctx) => {
    const glyphs = new Set((snapshotOf(ctx.root)?.glyphs ?? []).map((g) => g.glyph));
    return result(checkIconUsage(componentSources(ctx.root), registryFile, glyphs));
  },

  "package-exports": (ctx) => result(checkPackage(ctx.root)),

  "storybook-build": (ctx) => result(checkStorybookBuild(ctx.root)),

  "live-token-sample": async (ctx) => {
    const entries: { name: string }[] = JSON.parse(read(ctx.root, outputFiles.baseline) ?? '{ "tokens": [] }').tokens;
    const baseline = new Map(entries.map((t) => [t.name, t as unknown as Record<string, { value: string }>]));
    return live(await withPage(ctx.root, storybookDir, "pnpm verify:build", checkTokenSample(baseline)));
  },

  "live-reduced-motion": async (ctx) => {
    const fast = ctx.generation().resolved.get("motion.semantic.duration-fast")?.modes.light.value as { value: number } | undefined;
    return live(await withPage(ctx.root, storybookDir, "pnpm verify:build", checkLiveReducedMotion(fast?.value ?? Number.NaN)));
  },

  "live-fixture-host": async (ctx) =>
    live(await withPage(ctx.root, fixtureDist, "pnpm fixture:install && pnpm verify:build", checkHostMotion)),

  "fixture-astro": (ctx) => {
    const { skip, failures } = checkFixture(ctx.root);
    return skip ? { status: "skip", reason: skip } : result(failures);
  },
};

const contractDir = "docs/components";

interface ContractFile {
  file: string;
  json: Record<string, unknown>;
}

function readContracts(root: string): ContractFile[] {
  return readdirSync(join(root, contractDir))
    .filter((f) => f.endsWith(".json") && f !== "component-contract.schema.json")
    .map((f) => ({ file: `${contractDir}/${f}`, json: JSON.parse(readFileSync(join(root, contractDir, f), "utf8")) }));
}

export interface GateSpec {
  id: string;
  tier: Tier;
  description: string;
}

export function readGateSpecs(root: string): GateSpec[] {
  return JSON.parse(readFileSync(join(root, ".keen/gates.json"), "utf8")).gates;
}

// With strict, a skipped gate fails the run. CI passes it for the tiers whose prerequisites it installs, so a missing
// browser or fixture there means CI broke, not that the check does not apply.
export async function runGates(root: string, tier: Tier, log: (line: string) => void, { strict = false } = {}): Promise<boolean> {
  const specs = readGateSpecs(root);
  const declared = new Set(specs.map((s) => s.id));
  const undeclared = Object.keys(gates).filter((id) => !declared.has(id));
  const unknown = specs.filter((s) => !gates[s.id]).map((s) => s.id);
  if (undeclared.length > 0 || unknown.length > 0) {
    log(
      `.keen/gates.json is out of step with the gate code: undeclared ${undeclared.join(", ") || "none"}; unknown ${unknown.join(", ") || "none"}`,
    );
    return false;
  }
  let generation: Generation | undefined;
  const ctx: Context = { root, generation: () => (generation ??= generate(readSources(root), readExtras(root))) };
  const counts = { pass: 0, fail: 0, skip: 0 };
  log(`keen verify: ${tier} tier`);
  const tierSpecs = specs.filter((s) => s.tier === tier);
  if (tierSpecs.length === 0) {
    counts.skip++;
    log(`  SKIP ${tier} tier: no ${tier} gates exist yet`);
  }
  for (const spec of tierSpecs) {
    let outcome: GateResult;
    try {
      outcome = await gates[spec.id](ctx);
    } catch (error) {
      outcome = { status: "fail", reasons: [error instanceof Error ? error.message : String(error)] };
    }
    counts[outcome.status]++;
    log(`  ${outcome.status.toUpperCase().padEnd(4)} ${spec.id}: ${spec.description}`);
    if (outcome.status === "fail") for (const reason of outcome.reasons) log(`       - ${reason}`);
    if (outcome.status === "skip") log(`       skipped: ${outcome.reason}`);
    if (outcome.status === "pass") for (const note of outcome.notes ?? []) log(`       note: ${note}`);
  }
  log(`${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped (skipped checks are not passes)`);
  if (strict && counts.skip > 0) log(`strict: ${counts.skip} skipped, which fails the run`);
  return counts.fail === 0 && !(strict && counts.skip > 0);
}
