// Naming and reference invariants of the committed generated token outputs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { keenTokens } from "../../src/tokens/tokens.ts";

const css = readFileSync(new URL("../../src/tokens/tokens.css", import.meta.url), "utf8");
const baseline = JSON.parse(readFileSync(new URL("../../../../.keen/baselines/tokens.json", import.meta.url), "utf8"));
const declared = [...css.matchAll(/^\s+(--keen-[a-z0-9-]+):/gm)].map((m) => m[1]);
const values = (node: object): string[] => Object.values(node).flatMap((v) => (typeof v === "string" ? [v] : values(v)));

describe("generated tokens", () => {
  it("carries the tier in every declared CSS variable", () => {
    for (const name of declared) expect(name).toMatch(/^--keen-([a-z]+-(primitive|semantic)-|chat-)/);
  });

  it("resolves every var() in the stylesheet to a declared variable", () => {
    for (const [, name] of css.matchAll(/var\((--keen-[a-z0-9-]+)\)/g)) expect(declared).toContain(name);
  });

  it("exposes only semantic and component tokens in the typed map", () => {
    const reads = values(keenTokens);
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) expect(read).not.toMatch(/-primitive-/);
  });

  it("records every token in the baseline with a resolved light and dark value", () => {
    for (const token of baseline.tokens) {
      expect(token.light.value, token.name).not.toBeNull();
      expect(token.dark.value, token.name).not.toBeNull();
    }
  });
});
