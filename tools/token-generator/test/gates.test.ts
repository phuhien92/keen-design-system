// The gate runner against a temporary copy of the repository's token inputs and outputs.
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gates, runGates } from "../src/gates.ts";
import { outputFiles, repoRoot } from "../src/pipeline.ts";

// Reading design/keen.pen through the pen CLI is slow and needs a signed-in CLI; pen.test.ts and icons.test.ts cover those gates.
const live = { pen: gates["pen-live"], icons: gates["icons-live"] };
beforeAll(() => {
  gates["pen-live"] = () => ({ status: "skip", reason: "stubbed in gates.test.ts" });
  gates["icons-live"] = () => ({ status: "skip", reason: "stubbed in gates.test.ts" });
});
afterAll(() => {
  gates["pen-live"] = live.pen;
  gates["icons-live"] = live.icons;
});

function copyRepo() {
  const root = mkdtempSync(join(tmpdir(), "keen-gates-"));
  for (const path of [
    "tokens",
    ".keen",
    "docs",
    "design",
    "packages/keen/package.json",
    "packages/keen/src",
    ...Object.values(outputFiles),
  ]) {
    cpSync(join(repoRoot, path), join(root, path), { recursive: true });
  }
  symlinkSync(join(repoRoot, "packages/keen/node_modules"), join(root, "packages/keen/node_modules"));
  return root;
}

const run = (root: string) => {
  const lines: string[] = [];
  const ok = runGates(root, "fast", (line) => lines.push(line));
  return { ok, output: lines.join("\n") };
};

const edit = (root: string, file: string, change: (text: string) => string) =>
  writeFileSync(join(root, file), change(readFileSync(join(root, file), "utf8")));

describe("fast tier", () => {
  it("passes on the committed repository", () => {
    const { ok, output } = run(repoRoot);
    expect(output).toMatch(/0 failed/);
    expect(ok).toBe(true);
  });

  it("fails when a generated file was hand-edited", () => {
    const root = copyRepo();
    edit(root, outputFiles.css, (css) => css.replace("#2557D6", "#2557D7"));
    const { ok, output } = run(root);
    expect(ok).toBe(false);
    expect(output).toMatch(/FAIL tokens-generated[\s\S]*tokens\.css is stale or hand-edited/);
  });

  it("fails when a token changes without regenerating the baseline", () => {
    const root = copyRepo();
    edit(root, "tokens/component.json", (json) => json.replace('"value": 320', '"value": 360'));
    const { ok, output } = run(root);
    expect(ok).toBe(false);
    expect(output).toMatch(/FAIL tokens-baseline/);
  });

  it("fails on a dangling reference even after rebaselining", () => {
    const root = copyRepo();
    edit(root, "tokens/semantic.json", (json) => json.replace("{color.primitive.blue-600}", "{color.primitive.blue-650}"));
    const { ok, output } = run(root);
    expect(ok).toBe(false);
    expect(output).toMatch(/FAIL tokens-valid[\s\S]*references missing token \{color\.primitive\.blue-650\}/);
  });

  it("fails when a contract contrast pair is not met", () => {
    const root = copyRepo();
    edit(root, "tokens/semantic.json", (json) => json.replace('"{color.primitive.gray-600}"', '"{color.primitive.gray-300}"'));
    const { output } = run(root);
    expect(output).toMatch(/FAIL tokens-contrast[\s\S]*text-subtle on color\.semantic\.surface is .* in light/);
  });

  it("fails when .keen/gates.json and the gate code disagree", () => {
    const root = copyRepo();
    edit(root, ".keen/gates.json", (json) => json.replace('"tokens-contrast"', '"tokens-contrast-typo"'));
    const { ok, output } = run(root);
    expect(ok).toBe(false);
    expect(output).toMatch(/undeclared tokens-contrast; unknown tokens-contrast-typo/);
  });

  it("reports a skipped gate as skipped, not passed", () => {
    const root = copyRepo();
    const original = gates["tokens-contrast"];
    gates["tokens-contrast"] = () => ({ status: "skip", reason: "no contracts" });
    try {
      const { ok, output } = run(root);
      expect(ok).toBe(true);
      expect(output).toMatch(/SKIP tokens-contrast[\s\S]*skipped: no contracts/);
      expect(output).toMatch(/13 passed, 0 failed, 3 skipped/);
    } finally {
      gates["tokens-contrast"] = original;
    }
  });
});

describe("tiers without gates", () => {
  for (const tier of ["live"] as const) {
    it(`reports the ${tier} tier as skipped, not passed`, () => {
      const lines: string[] = [];
      const ok = runGates(repoRoot, tier, (line) => lines.push(line));
      const output = lines.join("\n");
      expect(ok).toBe(true);
      expect(output).toContain(`SKIP ${tier} tier: no ${tier} gates exist yet`);
      expect(output).toMatch(/0 passed, 0 failed, 1 skipped/);
    });
  }
});
