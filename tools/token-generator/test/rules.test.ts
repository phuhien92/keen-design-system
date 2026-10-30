// Each fast-tier token rule, proven by a deliberately broken fixture.
import { describe, expect, it } from "vitest";
import { checkContrast } from "../src/contrast.ts";
import type { Source } from "../src/model.ts";
import { generate } from "../src/pipeline.ts";

const color = (hex: string) => ({
  colorSpace: "srgb",
  components: [1, 3, 5].map((i) => Math.round((Number.parseInt(hex.slice(i, i + 2), 16) / 255) * 10000) / 10000),
  hex,
});

// Fixtures are deliberately mutated into invalid shapes, so they are loosely typed.
// biome-ignore lint/suspicious/noExplicitAny: see above
type Loose = Record<string, any>;

// A minimal valid token set; each test breaks one thing.
function fixture() {
  return {
    primitive: {
      color: { $type: "color", primitive: { "blue-600": { $value: color("#2557D6") }, white: { $value: color("#FFFFFF") } } },
      space: { $type: "dimension", primitive: { md: { $value: { value: 16, unit: "px" } } } },
    } as Loose,
    semantic: {
      color: {
        $type: "color",
        semantic: {
          action: { $value: "{color.primitive.blue-600}", $description: "Primary action fill." },
          surface: { $value: "{color.primitive.white}", $description: "Panel background." },
        },
      },
    } as Loose,
    component: {
      chat: { "message-gap": { $type: "dimension", $value: "{space.primitive.md}", $description: "Gap between messages." } },
    } as Loose,
  };
}

const sources = (f: ReturnType<typeof fixture>): Source[] => [
  { file: "tokens/primitive.json", tier: "primitive", json: f.primitive },
  { file: "tokens/semantic.json", tier: "semantic", json: f.semantic },
  { file: "tokens/component.json", tier: "component", json: f.component },
];

const rulesOf = (f: ReturnType<typeof fixture>) => generate(sources(f)).issues.map((i) => `${i.rule} ${i.token}`);

describe("token rules", () => {
  it("accepts the valid fixture", () => {
    expect(rulesOf(fixture())).toEqual([]);
  });

  it("rejects a token without a $value type", () => {
    const f = fixture();
    delete f.primitive.space.$type;
    expect(rulesOf(f)).toContain("type space.primitive.md");
  });

  it("rejects a dimension without an allowed unit", () => {
    const f = fixture();
    f.primitive.space.primitive.md.$value = { value: 16, unit: "pt" };
    expect(rulesOf(f)).toContain("value space.primitive.md");
  });

  it("rejects a color whose components do not match its hex", () => {
    const f = fixture();
    f.primitive.color.primitive.white.$value = { ...color("#FFFFFF"), hex: "#FFFFFE" };
    expect(rulesOf(f)).toContain("value color.primitive.white");
  });

  it("rejects a reference to a missing token", () => {
    const f = fixture();
    f.semantic.color.semantic.action.$value = "{color.primitive.blue-700}";
    expect(rulesOf(f)).toContain("reference color.semantic.action");
  });

  it("rejects a reference to a token of another type", () => {
    const f = fixture();
    f.semantic.color.semantic.action.$value = "{space.primitive.md}";
    expect(rulesOf(f)).toContain("reference color.semantic.action");
  });

  it("rejects a reference cycle", () => {
    const f = fixture();
    f.semantic.color.semantic.action.$value = "{color.semantic.surface}";
    f.semantic.color.semantic.surface.$value = "{color.semantic.action}";
    expect(rulesOf(f)).toContain("cycle color.semantic.action");
  });

  it("rejects a semantic or component token without a description", () => {
    const f = fixture();
    delete f.component.chat["message-gap"].$description;
    expect(rulesOf(f)).toContain("description chat.message-gap");
  });

  it("rejects a token whose tier segment does not match its file", () => {
    const f = fixture();
    f.semantic.color.primitive = { "red-700": { $value: color("#B42318") } };
    expect(rulesOf(f)).toContain("tier color.primitive.red-700");
  });

  it("rejects a token path without a tier segment", () => {
    const f = fixture();
    f.component.space = { $type: "dimension", gap: { $value: { value: 8, unit: "px" }, $description: "No tier." } };
    expect(rulesOf(f)).toContain("tier space.gap");
  });

  it("rejects a name that is not kebab-case", () => {
    const f = fixture();
    f.semantic.color.semantic.textPrimary = { $value: "{color.primitive.white}", $description: "Body text." };
    expect(rulesOf(f)).toContain("naming color.semantic.textPrimary");
  });

  it("rejects two tokens that generate the same CSS variable", () => {
    const f = fixture();
    f.component.chat["message-gap"] = undefined;
    f.component.chat = {
      "message-gap": { $type: "dimension", $value: { value: 8, unit: "px" }, $description: "Gap." },
      message: { gap: { $type: "dimension", $value: { value: 8, unit: "px" }, $description: "Gap." } },
    };
    expect(rulesOf(f)).toContain("duplicate chat.message.gap");
  });

  it("rejects an unknown mode", () => {
    const f = fixture();
    f.semantic.color.semantic.action.$extensions = { keen: { modes: { dim: "{color.primitive.white}" } } };
    expect(rulesOf(f)).toContain("schema color.semantic.action");
  });

  it("rejects a contrast pair below its minimum", () => {
    const f = fixture();
    f.primitive.color.primitive["blue-600"].$value = color("#F0F0FF");
    const { resolved } = generate(sources(f));
    const failures = checkContrast(
      [{ foreground: "color.semantic.action", background: "color.semantic.surface", minimum: 3 }],
      resolved,
      "chat.json",
    );
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/below 3:1/);
  });
});

describe("generated output", () => {
  it("does not depend on authoring order", () => {
    const f = fixture();
    const reversed = fixture();
    reversed.primitive.color.primitive = Object.fromEntries(Object.entries(reversed.primitive.color.primitive).reverse());
    expect(generate(sources(reversed)).files).toEqual(generate(sources(f)).files);
  });

  it("keeps the tier in CSS variables and resolves semantic roles through primitives", () => {
    const css = generate(sources(fixture())).files["packages/keen/src/tokens/tokens.css"];
    expect(css).toContain("--keen-color-primitive-blue-600: #2557D6;");
    expect(css).toContain("--keen-color-semantic-action: var(--keen-color-primitive-blue-600);");
  });

  it("re-declares mode-dependent tokens in both the light and the dark block", () => {
    const f = fixture();
    f.semantic.color.semantic.surface.$extensions = { keen: { modes: { dark: "{color.primitive.blue-600}" } } };
    const css = generate(sources(f)).files["packages/keen/src/tokens/tokens.css"];
    expect(css).toMatch(/\[data-keen-mode="light"\] \{\n {2}--keen-color-semantic-surface: var\(--keen-color-primitive-white\);\n\}/);
    expect(css).toMatch(/\[data-keen-mode="dark"\] \{\n {2}--keen-color-semantic-surface: var\(--keen-color-primitive-blue-600\);\n\}/);
  });

  it("emits no mode blocks when no token depends on the mode", () => {
    const css = generate(sources(fixture())).files["packages/keen/src/tokens/tokens.css"];
    expect(css).not.toContain("[data-keen-mode=");
  });

  it("declares an alias token as a custom property that references its target", () => {
    const f = fixture();
    f.component.chat["user-background"] = { $type: "color", $value: "{color.semantic.action}", $description: "User bubble." };
    const { files } = generate(sources(f));
    expect(files["packages/keen/src/tokens/tokens.css"]).toContain("--keen-chat-user-background: var(--keen-color-semantic-action);");
    expect(files["packages/keen/src/tokens/tokens.ts"]).toContain('"user-background": "var(--keen-chat-user-background)"');
  });

  it("leaves primitives out of the typed token map", () => {
    const types = generate(sources(fixture())).files["packages/keen/src/tokens/tokens.ts"];
    expect(types).not.toContain("-primitive-");
    expect(types).toContain('action: "var(--keen-color-semantic-action)"');
  });
});
