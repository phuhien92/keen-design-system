// Each motion, icon, and ds-allow rule, proven by a deliberately broken fixture.
import { describe, expect, it } from "vitest";
import { checkReads } from "../src/boundary.ts";
import { cssVar } from "../src/model.ts";
import { emitReducedMotion, type MotionRegistry, semanticDurations, useVariables } from "../src/motion.ts";
import { checkAllowDirectives, checkIconUsage, checkMotionUsage, checkReducedMotion } from "../src/motion-checks.ts";
import { generate, readExtras, readSources, repoRoot } from "../src/pipeline.ts";

const { tokens } = generate(readSources(repoRoot), readExtras(repoRoot));
const uses = useVariables(tokens);
const durations = semanticDurations(tokens).map((t) => cssVar(t.name));
const empty: MotionRegistry = { loops: [], entrances: [] };
const registry: MotionRegistry = {
  loops: [{ keyframes: "keen-dots", selector: ".keen-chat__dot", frame: { opacity: "1" } }],
  entrances: [{ keyframes: "keen-enter", selector: ".keen-chat__message" }],
};
const css = (text: string) => [{ path: "packages/keen/src/components/Chat/Chat.css", text }];
const fast = "var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-standard)";
const loop = "var(--keen-motion-semantic-duration-loop) var(--keen-motion-semantic-easing-linear)";
const enter = "var(--keen-motion-semantic-duration-slow) var(--keen-motion-semantic-easing-entrance)";

describe("motion-usage", () => {
  it("accepts named uses on animatable properties", () => {
    const text = `.a {\n  transition: background-color ${fast}, opacity ${fast};\n}\n.b {\n  animation: keen-dots ${loop} infinite;\n}\n.c {\n  animation: keen-enter ${enter};\n}`;
    expect(checkMotionUsage(css(text), uses, registry)).toEqual([]);
  });

  it("rejects a literal duration", () => {
    expect(checkMotionUsage(css(".a {\n  transition: opacity 200ms ease;\n}"), uses, empty)).toEqual([
      "packages/keen/src/components/Chat/Chat.css:2: literal duration or easing in transition; apply a named motion use",
    ]);
  });

  it("rejects a motion primitive read", () => {
    const text = ".a {\n  transition: opacity var(--keen-motion-primitive-duration-150) var(--keen-motion-semantic-easing-standard);\n}";
    const index = { vars: new Map(tokens.map((t) => [cssVar(t.name), t.name])) };
    expect(checkReads(css(text), index).failures[0]).toMatch(/reads primitive --keen-motion-primitive-duration-150/);
    expect(checkMotionUsage(css(text), uses, empty)[0]).toMatch(/does not apply a named motion use/);
  });

  it("rejects a transition outside the named uses", () => {
    const text = ".a {\n  transition: opacity var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-entrance);\n}";
    expect(checkMotionUsage(css(text), uses, empty)[0]).toMatch(/does not apply a named motion use/);
  });

  it("rejects a use split into longhands", () => {
    const text = ".a {\n  transition-duration: var(--keen-motion-semantic-duration-fast);\n}";
    expect(checkMotionUsage(css(text), uses, empty)[0]).toMatch(/transition-duration splits a use/);
  });

  it("rejects animating a layout property", () => {
    const text = `.a {\n  transition: width ${fast};\n}\n@keyframes keen-grow {\n  to {\n    height: 10px;\n  }\n}`;
    expect(checkMotionUsage(css(text), uses, empty)).toEqual([
      "packages/keen/src/components/Chat/Chat.css:2: transitions width; animate only opacity, transform, and colors",
      "packages/keen/src/components/Chat/Chat.css: @keyframes keen-grow animates height; animate only opacity, transform, and colors",
    ]);
  });

  it("rejects an unregistered loop", () => {
    expect(checkMotionUsage(css(`.b {\n  animation: keen-dots ${loop} infinite;\n}`), uses, empty)).toEqual([
      "packages/keen/src/components/Chat/Chat.css:2: infinite animation keen-dots is not in the loop registry",
    ]);
  });

  it("rejects an unregistered entrance", () => {
    expect(checkMotionUsage(css(`.c {\n  animation: keen-enter ${enter};\n}`), uses, empty)[0]).toMatch(
      /entrance animation keen-enter is not in the entrance registry/,
    );
  });

  it("accepts a literal sanctioned by ds-allow(motion)", () => {
    const text = ".a {\n  transition: opacity 50ms linear; /* ds-allow(motion): caret blink must match the OS rate */\n}";
    expect(checkMotionUsage(css(text), uses, empty)).toEqual([]);
  });
});

describe("ds-allow", () => {
  it("accepts known categories with a reason", () => {
    expect(checkAllowDirectives(css("/* ds-allow(icon-size): the empty-state icon is 22px in the design */"))).toEqual([]);
  });

  it("rejects a misspelled category", () => {
    expect(checkAllowDirectives(css("/* ds-allow(motoin): typo */"))).toEqual([
      'packages/keen/src/components/Chat/Chat.css: unknown ds-allow category "motoin"; use motion, icon-size, color',
    ]);
  });

  it("rejects a directive without a reason", () => {
    expect(checkAllowDirectives(css("/* ds-allow(color) */"))[0]).toMatch(/malformed/);
  });
});

describe("reduced-motion", () => {
  const generated = emitReducedMotion(tokens, registry);

  it("collapses every semantic duration, guards scrolling, and parks registered loops inside Keen's root", () => {
    expect(checkReducedMotion(generated, durations, registry, [])).toEqual([]);
    expect(generated).toContain("[data-keen-root] .keen-chat__dot {\n    animation: none;\n    opacity: 1;\n  }");
    expect(generated).toContain("[data-keen-root] .keen-chat__message {\n    animation: none;\n  }");
  });

  it("rejects a reduced-motion rule scoped to the host page", () => {
    const text = "@media (prefers-reduced-motion: reduce) {\n  * {\n    animation: none;\n  }\n}";
    expect(checkReducedMotion(generated, durations, registry, css(text))).toEqual([
      'packages/keen/src/components/Chat/Chat.css: reduced-motion rule "*" is not scoped to [data-keen-root]',
    ]);
  });

  it("rejects a generated block that does not collapse to 0.01ms", () => {
    const broken = generated.replace("--keen-motion-semantic-duration-fast: 0.01ms", "--keen-motion-semantic-duration-fast: 0ms");
    expect(checkReducedMotion(broken, durations, registry, [])).toEqual([
      "reduced-motion.css does not set --keen-motion-semantic-duration-fast to 0.01ms",
    ]);
  });

  it("rejects a loop without its parking rule", () => {
    expect(checkReducedMotion(emitReducedMotion(tokens, empty), durations, registry, [])).toEqual([
      "reduced-motion.css has no rule parking loop keen-dots",
    ]);
  });
});

describe("icon-usage", () => {
  const glyphs = new Set(["arrow-up"]);
  const tsx = (path: string, text: string) => [{ path, text }];

  it("rejects a Lucide import outside the registry", () => {
    expect(
      checkIconUsage(
        tsx("packages/keen/src/components/Chat/Chat.tsx", 'import { Bell } from "lucide-react";'),
        "packages/keen/src/icons/registry.ts",
        glyphs,
      ),
    ).toEqual(["packages/keen/src/components/Chat/Chat.tsx: imports lucide-react; only packages/keen/src/icons/registry.ts may"]);
  });

  it("rejects a glyph the design does not use", () => {
    expect(
      checkIconUsage(
        tsx("packages/keen/src/components/Chat/Chat.tsx", '<Icon name="bell" />'),
        "packages/keen/src/icons/registry.ts",
        glyphs,
      ),
    ).toEqual(['packages/keen/src/components/Chat/Chat.tsx: names icon "bell", which the design does not use']);
  });
});
