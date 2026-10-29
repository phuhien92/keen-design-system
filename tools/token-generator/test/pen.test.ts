// The Pen variables generated from DTCG, and the gates that keep design/keen.pen in step with the tokens.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gates } from "../src/gates.ts";
import { penVariables, variablesFile } from "../src/pen.ts";
import { generate, readSources, repoRoot } from "../src/pipeline.ts";

const context = (root: string) => {
  const generation = generate(readSources(root));
  return { root, generation: () => generation };
};

describe("penVariables", () => {
  const { variables } = penVariables(generate(readSources(repoRoot)).tokens);

  it("themes semantic colors through primitive references", () => {
    expect(variables["color.semantic.action"]).toEqual({
      type: "color",
      value: [
        { value: "$color.primitive.blue-600", theme: { mode: "light" } },
        { value: "$color.primitive.blue-300", theme: { mode: "dark" } },
      ],
    });
  });

  it("maps dimensions to numbers, font families to their first name, and keeps component references", () => {
    expect(variables["space.primitive.md"]).toEqual({ type: "number", value: 16 });
    expect(variables["font.primitive.family-inter"]).toEqual({ type: "string", value: "Inter" });
    expect(variables["font.primitive.weight-semibold"]).toEqual({ type: "string", value: "600" });
    expect(variables["chat.message-user-background"]).toEqual({ type: "color", value: "$color.semantic.action" });
  });
});

describe("pen-variables", () => {
  it("passes on the committed design", () => {
    expect(gates["pen-variables"](context(repoRoot))).toEqual({ status: "pass" });
  });

  it("fails when a provisional variable remains in the design", () => {
    const root = mkdtempSync(join(tmpdir(), "keen-pen-"));
    for (const path of ["tokens", variablesFile]) cpSync(join(repoRoot, path), join(root, path), { recursive: true });
    const file = JSON.parse(readFileSync(join(root, variablesFile), "utf8"));
    file.variables["color.semantic.action"] = { type: "color", value: "#2557D6" };
    writeFileSync(join(root, variablesFile), `${JSON.stringify(file, null, 2)}\n`);
    expect(gates["pen-variables"](context(root))).toMatchObject({ status: "fail" });
  });
});

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
});
