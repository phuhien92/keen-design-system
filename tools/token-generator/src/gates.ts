// The verification gates named in .keen/gates.json. Each gate passes, fails with reasons, or is skipped with a reason.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkContracts, checkForwarding, checkReads, componentSources, type TokenIndex } from "./boundary.ts";
import { type ContrastPair, checkContrast } from "./contrast.ts";
import { emitsVariable } from "./emit.ts";
import { cssVar } from "./model.ts";
import { checkFixture, checkPackage } from "./package.ts";
import { designFile, normalize, type PenVariables, penVariables, readPenVariables, serializeVariables, variablesFile } from "./pen.ts";
import { formatIssue, type Generation, generate, outputFiles, readSources } from "./pipeline.ts";

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
const read = (root: string, file: string) => (existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8") : undefined);

export const gates: Record<string, (ctx: Context) => GateResult> = {
  "tokens-valid": (ctx) => result(ctx.generation().issues.map(formatIssue)),

  "tokens-generated": (ctx) => {
    const first = ctx.generation();
    if (first.issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const second = generate(readSources(ctx.root));
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
    const dir = join(ctx.root, "docs/components");
    const contracts = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "component-contract.schema.json");
    const reasons = contracts.flatMap((file) => {
      const pairs: ContrastPair[] = JSON.parse(readFileSync(join(dir, file), "utf8")).contrast ?? [];
      return checkContrast(pairs, resolved, `docs/components/${file}`);
    });
    return result(reasons);
  },

  "pen-variables": (ctx) => {
    const { tokens, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    if (read(ctx.root, variablesFile) === serializeVariables(penVariables(tokens))) return pass;
    return { status: "fail", reasons: [`${variablesFile} differs from the variables the tokens generate; run pnpm design:push`] };
  },

  "pen-live": (ctx) => {
    const { tokens, issues } = ctx.generation();
    if (issues.length > 0) return { status: "fail", reasons: ["token sources have issues; see tokens-valid"] };
    const live = readPenVariables(join(ctx.root, designFile));
    if (!live.ok) return live.unavailable ? { status: "skip", reason: live.error } : { status: "fail", reasons: [live.error] };
    const expected = penVariables(tokens);
    const actual = normalize(live.value as PenVariables, Object.keys(expected.variables));
    if (JSON.stringify(actual) === JSON.stringify(expected)) return pass;
    const names = new Set([...Object.keys(actual.variables), ...Object.keys(expected.variables)]);
    const differing = [...names].filter((n) => JSON.stringify(actual.variables[n]) !== JSON.stringify(expected.variables[n]));
    return { status: "fail", reasons: [`${designFile} variables differ from the tokens: ${differing.join(", ")}; run pnpm design:push`] };
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

  "package-exports": (ctx) => result(checkPackage(ctx.root)),

  "fixture-astro": (ctx) => {
    const { skip, failures } = checkFixture(ctx.root);
    return skip ? { status: "skip", reason: skip } : result(failures);
  },
};

export interface GateSpec {
  id: string;
  tier: Tier;
  description: string;
}

export function readGateSpecs(root: string): GateSpec[] {
  return JSON.parse(readFileSync(join(root, ".keen/gates.json"), "utf8")).gates;
}

export function runGates(root: string, tier: Tier, log: (line: string) => void): boolean {
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
  const ctx: Context = { root, generation: () => (generation ??= generate(readSources(root))) };
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
      outcome = gates[spec.id](ctx);
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
  return counts.fail === 0;
}
