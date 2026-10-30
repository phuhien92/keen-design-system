// Each fast-tier token rule, proven by a deliberately broken fixture.
import { describe, expect, it } from "vitest";
import { type Binding, type Contract, checkContract } from "../src/contract.ts";
import { checkContrast } from "../src/contrast.ts";
import { checkDesignAnatomy, checkDesignVariables } from "../src/design.ts";
import type { Source } from "../src/model.ts";
import type { PenNode, PenVariable } from "../src/pen.ts";
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

describe("contract bindings", () => {
  const contract = (bindings: Binding[]): Contract => ({
    component: "Chat",
    anatomy: [{ part: "root", element: "section", description: "Panel." }],
    bindings,
  });
  const valid: Binding[] = [
    { part: "root", property: "background", token: "color.semantic.surface" },
    { part: "root", property: "gap", token: "chat.message-gap" },
  ];
  const check = (bindings: Binding[]) => checkContract(contract(bindings), generate(sources(fixture())).resolved, "chat.json");

  it("accepts bindings to declared tokens of the right type", () => {
    expect(check(valid)).toEqual([]);
  });

  it("rejects a binding to a token the token files do not declare", () => {
    expect(check([...valid, { part: "root", property: "color", token: "color.semantic.focus" }])).toEqual([
      "chat.json: binding root color → color.semantic.focus names a token tokens/*.json does not declare",
    ]);
  });

  it("rejects a binding whose token type does not fit the property", () => {
    const failures = check([...valid, { part: "root", property: "radius", token: "color.semantic.action" }]);
    expect(failures[0]).toMatch(/binds a color token to radius, which takes dimension/);
  });

  it("rejects a component token no binding uses", () => {
    expect(check([valid[0]])).toEqual(["chat.json: chat.message-gap is declared in tokens/*.json but no binding in the contract uses it"]);
  });
});

describe("Pen variables", () => {
  const design = JSON.stringify({ version: "2.21", children: [], themes: { mode: ["light", "dark"] }, variables: {} }, null, 2);
  const variablesOf = (f: ReturnType<typeof fixture>) => JSON.parse(generate(sources(f), design).files["design/keen.pen"]).variables;

  it("writes semantic and component tokens and leaves primitives out", () => {
    const variables = variablesOf(fixture());
    expect(Object.keys(variables)).toEqual(["color.semantic.action", "color.semantic.surface", "chat.message-gap"]);
    expect(variables["chat.message-gap"]).toEqual({ type: "number", value: 16 });
  });

  it("writes a mode-dependent color once per mode", () => {
    const f = fixture();
    f.semantic.color.semantic.surface.$extensions = { keen: { modes: { dark: "{color.primitive.blue-600}" } } };
    expect(variablesOf(f)["color.semantic.surface"].value).toEqual([
      { value: "#FFFFFF", theme: { mode: "light" } },
      { value: "#2557D6", theme: { mode: "dark" } },
    ]);
  });

  it("keeps an alias of a designed token as an alias", () => {
    const f = fixture();
    f.component.chat["user-background"] = { $type: "color", $value: "{color.semantic.action}", $description: "User bubble." };
    expect(variablesOf(f)["chat.user-background"]).toEqual({ type: "color", value: "$color.semantic.action" });
  });

  it("rejects a dimension Pen cannot hold", () => {
    const f = fixture();
    f.primitive.space.primitive.md.$value = { value: 1, unit: "rem" };
    expect(generate(sources(f), design).issues.map((i) => `${i.rule} ${i.token}`)).toEqual(["pen chat.message-gap"]);
  });

  it("writes canvas tokens to Pen only", () => {
    const canvas = { canvas: { $type: "color", note: { $value: color("#4A5361"), $description: "Annotation text." } } };
    const { files } = generate([...sources(fixture()), { file: "design/canvas.json", tier: "canvas", json: canvas }], design);
    expect(JSON.parse(files["design/keen.pen"]).variables["canvas.note"]).toEqual({ type: "color", value: "#4A5361" });
    expect(files["packages/keen/src/tokens/tokens.css"]).not.toContain("canvas");
    expect(files[".keen/baselines/tokens.json"]).not.toContain("canvas");
  });
});

describe("design checks", () => {
  const variables: Record<string, PenVariable> = {
    "color.semantic.action": { type: "color", value: "#2557D6" },
    "color.semantic.surface": { type: "color", value: "#FFFFFF" },
    "canvas.frame": { type: "color", value: "#E8EBF0" },
  };
  const tag = { type: "keen-part", component: "Button", part: "root" };
  const button = (fill: string, metadata: object | null = tag, label = "$color.semantic.surface"): PenNode => ({
    type: "frame",
    id: "b",
    name: "Button",
    fill,
    ...(metadata ? { metadata } : {}),
    children: [{ type: "text", id: "t", name: "Label", fill: label }],
  });
  const contract: Contract = {
    component: "Button",
    anatomy: [{ part: "root", element: "button", description: "The button." }],
    bindings: [
      { part: "root", property: "background", token: "color.semantic.action" },
      { part: "root", property: "color", token: "color.semantic.surface" },
    ],
  };
  const anatomy = (children: PenNode[], c = contract) =>
    checkDesignAnatomy({ children, variables }, [{ file: "button.json", contract: c }]);

  it("rejects a typed-in color and names the variable to use", () => {
    expect(checkDesignVariables({ children: [button("#2557D6")], variables })).toEqual([
      "Button: fill is the typed-in color #2557D6; use $color.semantic.action",
    ]);
  });

  it("rejects a variable no token declares", () => {
    expect(checkDesignVariables({ children: [button("$color.semantic.missing")], variables })).toEqual([
      "Button: fill uses $color.semantic.missing, which no token declares",
    ]);
  });

  it("accepts a design that draws exactly what the contract binds, inherited color included", () => {
    expect(anatomy([button("$color.semantic.action")])).toEqual([]);
  });

  it("rejects a token the part does not bind, and the binding it left undrawn", () => {
    expect(anatomy([button("$color.semantic.surface")])).toEqual([
      "Button: draws background with $color.semantic.surface, but button.json binds root background → color.semantic.action",
      "button.json: binding root background → color.semantic.action is not drawn; draw it or mark it drawn: false",
    ]);
  });

  it("rejects a design layer that is not linked to a part", () => {
    const failures = anatomy([button("$color.semantic.action", null)]);
    expect(failures).toContain("Button: uses $color.semantic.action but draws no contract part; tag the layer with keen-part metadata");
    expect(failures).toContain("button.json: root is not drawn; no layer carries its keen-part metadata");
  });

  it("rejects a canvas variable inside a part", () => {
    expect(anatomy([button("$color.semantic.action", tag, "$canvas.frame")])[0]).toMatch(/uses \$canvas\.frame inside root/);
  });

  it("checks an instance override against the part of the layer it restyles, in any bound state", () => {
    const focused: Contract = {
      ...contract,
      bindings: [...contract.bindings, { part: "root", property: "border-color", state: "focus", token: "color.semantic.action" }],
    };
    const instance = (stroke: string): PenNode => ({
      type: "ref",
      id: "r",
      name: "Focused",
      ref: "b",
      descendants: { b: { stroke, strokeWidth: 2 } },
    });
    expect(anatomy([button("$color.semantic.action"), instance("$color.semantic.action")], focused)).toEqual([]);
    expect(anatomy([button("$color.semantic.action"), instance("$color.semantic.surface")], focused)[0]).toMatch(
      /^Focused \(override of Button\): draws border-color with \$color\.semantic\.surface/,
    );
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

  it("re-declares mode-dependent tokens in the dark block", () => {
    const f = fixture();
    f.semantic.color.semantic.surface.$extensions = { keen: { modes: { dark: "{color.primitive.blue-600}" } } };
    const css = generate(sources(f)).files["packages/keen/src/tokens/tokens.css"];
    expect(css).toMatch(/\[data-keen-mode="dark"\] \{\n {2}--keen-color-semantic-surface: var\(--keen-color-primitive-blue-600\);\n\}/);
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
