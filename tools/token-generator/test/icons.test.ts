// The icon registry generated from the design, and the gates that keep it in step with design/keen.pen.
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gates } from "../src/gates.ts";
import { emitRegistry, type IconSnapshot, iconIssues, iconSnapshotFile, lucideComponents, readDesignIcons } from "../src/icons.ts";
import { runPen } from "../src/pen.ts";
import { generate, outputFiles, readExtras, readSources, repoRoot } from "../src/pipeline.ts";

const lucide = lucideComponents(repoRoot);
const snapshot: IconSnapshot = JSON.parse(readFileSync(join(repoRoot, iconSnapshotFile), "utf8"));
const withGlyph = (glyph: string, library = "lucide"): IconSnapshot => ({
  ...snapshot,
  glyphs: [...snapshot.glyphs, { glyph, library, layers: ["Test Icon"], sizes: [18] }],
});
const context = (root: string) => {
  const generation = generate(readSources(root), readExtras(root));
  return { root, generation: () => generation };
};

describe("generation from the design", () => {
  it("registers every glyph the design uses", () => {
    expect(snapshot.glyphs.map((g) => g.glyph)).toEqual([
      "arrow-up",
      "circle-alert",
      "clock-4",
      "rotate-ccw",
      "sparkles",
      "square",
      "wifi-off",
    ]);
  });

  it("adds a glyph that the design adds", () => {
    expect(emitRegistry(withGlyph("bell"))).toContain('  "bell": Bell,');
  });

  it("fails on an icon from another family", () => {
    expect(iconIssues(withGlyph("home", "material"), lucide)).toEqual([
      { rule: "icon", token: "icon home", message: "uses icon family material in Test Icon; Keen uses Lucide only" },
    ]);
  });

  it("fails on a glyph Lucide does not have", () => {
    expect(iconIssues(withGlyph("not-a-glyph"), lucide)[0].message).toMatch(/is not a Lucide glyph/);
  });
});

describe("design gates", () => {
  const copy = () => {
    const root = mkdtempSync(join(tmpdir(), "keen-icons-"));
    for (const path of ["tokens", ".keen", "design", "docs/foundations", "packages/keen/package.json", "packages/keen/src"]) {
      cpSync(join(repoRoot, path), join(root, path), { recursive: true });
    }
    symlinkSync(join(repoRoot, "packages/keen/node_modules"), join(root, "packages/keen/node_modules"));
    return root;
  };

  it("fails when the design changed after its icons were read", () => {
    const root = copy();
    writeFileSync(join(root, "design/keen.pen"), `${readFileSync(join(root, "design/keen.pen"), "utf8")}\n`);
    expect(gates["icons-design"](context(root))).toMatchObject({ status: "fail" });
  });

  it("fails when generated JavaScript timings drift from their tokens", () => {
    const root = copy();
    const file = join(root, outputFiles.motionTimings);
    writeFileSync(file, readFileSync(file, "utf8").replace("ms: 150", "ms: 160"));
    expect(gates["motion-timings"](context(root))).toMatchObject({
      status: "fail",
      reasons: ["motion.ts duration-fast is 160 schedule; the token says 150 schedule"],
    });
  });

  // Adding an icon node to a copy of the design through the pen CLI adds it to the registry. Needs a signed-in pen CLI.
  const penAvailable = readDesignIcons(repoRoot, "design/keen.pen").ok;
  it.skipIf(!penAvailable)(
    "reads an icon node added to a copy of the design",
    () => {
      const root = mkdtempSync(join(tmpdir(), "keen-design-"));
      cpSync(join(repoRoot, "design/keen.pen"), join(root, "keen.pen"));
      const added = runPen(
        join(root, "keen.pen"),
        'Insert(document,{type:"icon",name:"Test Bell",icon:"bell",library:"lucide",width:18,height:18});Emit(true)',
        true,
      );
      expect(added).toMatchObject({ ok: true });
      const read = readDesignIcons(root, "keen.pen");
      if (!read.ok) throw new Error(read.error);
      expect(emitRegistry(read.snapshot)).toContain('  "bell": Bell,');
    },
    120_000,
  );
});
