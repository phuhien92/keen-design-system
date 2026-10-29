// The gate runner against a temporary copy of the repository's token inputs and outputs.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gates, runGates } from "../src/gates.ts";
import { outputFiles, repoRoot } from "../src/pipeline.ts";

function copyRepo() {
  const root = mkdtempSync(join(tmpdir(), "keen-gates-"));
  for (const path of ["tokens", ".keen", "docs/components", ...Object.values(outputFiles)]) {
    cpSync(join(repoRoot, path), join(root, path), { recursive: true });
  }
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
      expect(output).toMatch(/3 passed, 0 failed, 1 skipped/);
    } finally {
      gates["tokens-contrast"] = original;
    }
  });
});

describe("tiers without gates", () => {
  for (const tier of ["build", "live"] as const) {
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
