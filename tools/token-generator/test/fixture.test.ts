// The fixture-astro theming check, proven against Keen's generated stylesheet and deliberately broken host themes.
import { describe, expect, it } from "vitest";
import { keenProperties } from "../src/cascade.ts";
import type { Source } from "../src/model.ts";
import { checkFixtureCss } from "../src/package.ts";
import { generate } from "../src/pipeline.ts";

const color = (hex: string) => ({
  colorSpace: "srgb",
  components: [1, 3, 5].map((i) => Math.round((Number.parseInt(hex.slice(i, i + 2), 16) / 255) * 10000) / 10000),
  hex,
});

const sources: Source[] = [
  {
    file: "tokens/primitive.json",
    tier: "primitive",
    json: {
      color: { $type: "color", primitive: { "blue-600": { $value: color("#2557D6") }, "blue-300": { $value: color("#93B4F5") } } },
    },
  },
  {
    file: "tokens/semantic.json",
    tier: "semantic",
    json: {
      color: {
        $type: "color",
        semantic: {
          action: {
            $value: "{color.primitive.blue-600}",
            $description: "Primary action fill.",
            $extensions: { keen: { modes: { dark: "{color.primitive.blue-300}" } } },
          },
        },
      },
    },
  },
  {
    file: "tokens/component.json",
    tier: "component",
    json: {
      chat: { "message-user-background": { $type: "color", $value: "{color.semantic.action}", $description: "User bubble fill." } },
    },
  },
];

const keenCss = generate(sources).files["packages/keen/src/tokens/tokens.css"];

const pageTheme = `
:root, [data-keen-mode="light"] { --keen-color-semantic-action: #6d28d9; }
[data-keen-mode="dark"] { --keen-color-semantic-action: #c4b5fd; }`;

describe("fixture theming check", () => {
  it("accepts a page-level host theme and resolves the component alias to it in every context", () => {
    const css = keenCss + pageTheme;
    expect(checkFixtureCss(css, keenCss)).toEqual([]);
    expect(keenProperties(css, "root").get("--keen-chat-message-user-background")).toBe("#6d28d9");
    expect(keenProperties(css, "light").get("--keen-chat-message-user-background")).toBe("#6d28d9");
    expect(keenProperties(css, "dark").get("--keen-chat-message-user-background")).toBe("#c4b5fd");
  });

  it("accepts minified CSS with unquoted attributes and shortened colors", () => {
    const css = `${keenCss}:root,[data-keen-mode=light]{--keen-color-semantic-action:#FFF}[data-keen-mode=dark]{--keen-color-semantic-action:#c4b5fd}`;
    expect(checkFixtureCss(css, keenCss)).toEqual([]);
    expect(keenProperties(css, "light").get("--keen-chat-message-user-background")).toBe("#ffffff");
  });

  it("rejects a theme scoped to a host subtree, which never reaches the component alias", () => {
    const css = `${keenCss}.fixture-theme { --keen-color-semantic-action: #6d28d9; }`;
    expect(checkFixtureCss(css, keenCss)).toEqual([
      "the fixture does not override --keen-color-semantic-action in the root context",
      "the fixture does not override --keen-color-semantic-action in the light context",
      "the fixture does not override --keen-color-semantic-action in the dark context",
    ]);
  });

  it("rejects a :root-only theme, which a light subtree inside a dark page resets", () => {
    const css = `${keenCss}:root { --keen-color-semantic-action: #6d28d9; } [data-keen-mode="dark"] { --keen-color-semantic-action: #c4b5fd; }`;
    expect(checkFixtureCss(css, keenCss)).toEqual(["the fixture does not override --keen-color-semantic-action in the light context"]);
  });

  it("rejects a fixture whose component alias does not follow the host override", () => {
    const css = `${keenCss + pageTheme}:root, [data-keen-mode="light"], [data-keen-mode="dark"] { --keen-chat-message-user-background: #000000; }`;
    expect(checkFixtureCss(css, keenCss)).toHaveLength(3);
  });

  it("rejects a theme that overrides a primitive", () => {
    const css = `${keenCss + pageTheme}:root { --keen-color-primitive-blue-600: #6d28d9; }`;
    expect(checkFixtureCss(css, keenCss)).toEqual(["the fixture overrides a primitive; hosts theme through semantic tokens"]);
  });

  it("ignores declarations inside conditional at-rules", () => {
    const css = `${keenCss}@media (prefers-color-scheme: dark) { :root { --keen-color-semantic-action: #6d28d9; } }`;
    expect(keenProperties(css, "root").get("--keen-color-semantic-action")).toBe("#2557d6");
  });
});
