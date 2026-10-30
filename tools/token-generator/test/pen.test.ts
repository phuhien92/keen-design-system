// The pen-live gate, which reads the variables tokens:build wrote into design/keen.pen back through the pen CLI.
// How the variables are generated is covered in rules.test.ts.
import { describe, expect, it } from "vitest";
import { gates } from "../src/gates.ts";
import { differingVariables } from "../src/pen.ts";
import { generate, readExtras, readSources, repoRoot } from "../src/pipeline.ts";

const context = (root: string) => {
  const generation = generate(readSources(root), readExtras(root));
  return { root, generation: () => generation };
};

describe("pen-live", () => {
  it("is skipped, not passed, when the pen CLI is unavailable", () => {
    const path = process.env.PATH;
    process.env.PATH = "";
    try {
      expect(gates["pen-live"](context(repoRoot))).toMatchObject({ status: "skip" });
    } finally {
      process.env.PATH = path;
    }
  });

  it("compares variables regardless of key order and names the ones that differ", () => {
    const action = { type: "color", value: "#2557D6" };
    const gap = { type: "number", value: 16 };
    expect(differingVariables({ gap, action }, { action, gap })).toEqual([]);
    expect(differingVariables({ action: { ...action, value: "#000000" }, gap }, { action, gap })).toEqual(["action"]);
    expect(differingVariables({ action }, { action, gap })).toEqual(["gap"]);
  });
});
