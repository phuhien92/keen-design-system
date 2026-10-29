// The customization-boundary rules, each proven by a deliberately broken component fixture.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkContracts, checkForwarding, checkReads, type TokenIndex } from "../src/boundary.ts";

const index: TokenIndex = {
  vars: new Map([
    ["--keen-color-semantic-action", "color.semantic.action"],
    ["--keen-color-primitive-blue-600", "color.primitive.blue-600"],
    ["--keen-chat-message-gap", "chat.message-gap"],
  ]),
};
const file = (path: string, text: string) => ({ path: `packages/keen/src/components/${path}`, text });

describe("component-forwarding", () => {
  it("accepts a component that owns its styling", () => {
    expect(
      checkForwarding([file("Chat/Chat.tsx", 'export function Chat({ labels }: Props) { return <section className="keen-chat" />; }')]),
    ).toEqual([]);
  });

  it("rejects props that declare className or style", () => {
    const failures = checkForwarding([file("Chat/Chat.tsx", "interface Props {\n  className?: string;\n  style: object;\n}")]);
    expect(failures).toEqual([
      "packages/keen/src/components/Chat/Chat.tsx: props declare className, a styling escape hatch",
      "packages/keen/src/components/Chat/Chat.tsx: props declare style, a styling escape hatch",
    ]);
  });

  it("rejects forwarding className from props", () => {
    expect(checkForwarding([file("Chat/Chat.tsx", "return <div className={props.className} />;")])).toHaveLength(1);
  });

  it("rejects spreading props onto an element", () => {
    expect(checkForwarding([file("Chat/Chat.tsx", "return <div {...rest} />;")])).toEqual([
      "packages/keen/src/components/Chat/Chat.tsx: spreads props onto an element",
    ]);
  });
});

describe("token-reads", () => {
  it("accepts semantic and component reads and the component's own hooks", () => {
    const css =
      ".a { color: var(--keen-color-semantic-action); gap: var(--keen-chat-message-gap); --keen-icon-size: 1em; width: var(--keen-icon-size); }";
    expect(checkReads([file("Chat/Chat.css", css)], index).failures).toEqual([]);
  });

  it("rejects a primitive read", () => {
    const { failures } = checkReads([file("Chat/Chat.css", ".a { color: var(--keen-color-primitive-blue-600); }")], index);
    expect(failures).toEqual([
      "packages/keen/src/components/Chat/Chat.css: reads primitive --keen-color-primitive-blue-600; components read semantic or component tokens",
    ]);
  });

  it("rejects a phantom read", () => {
    const { failures } = checkReads([file("Chat/Chat.css", ".a { color: var(--keen-color-semantic-actoin); }")], index);
    expect(failures[0]).toMatch(/reads --keen-color-semantic-actoin, which no token generates \(phantom\)/);
  });

  it("rejects a component that redeclares a token", () => {
    const { failures } = checkReads([file("Chat/Chat.css", ".a { --keen-color-semantic-action: red; }")], index);
    expect(failures[0]).toMatch(/declares token --keen-color-semantic-action/);
  });

  it("ignores reads inside comments", () => {
    expect(checkReads([file("Chat/Chat.css", "/* var(--keen-color-primitive-blue-600) */")], index).failures).toEqual([]);
  });
});

describe("contract-roles", () => {
  const root = mkdtempSync(join(tmpdir(), "keen-contract-"));
  mkdirSync(join(root, "docs/components"), { recursive: true });
  writeFileSync(join(root, "docs/components/chat.json"), JSON.stringify({ tokens: [{ name: "color.semantic.action" }] }));

  it("accepts reads the contract lists", () => {
    expect(checkContracts([file("Chat/Chat.css", ".a { color: var(--keen-color-semantic-action); }")], index, root)).toEqual([]);
  });

  it("rejects a semantic role the contract does not list", () => {
    expect(checkContracts([file("Chat/Chat.css", ".a { gap: var(--keen-chat-message-gap); }")], index, root)).toEqual([
      "packages/keen/src/components/Chat/Chat.css: reads chat.message-gap, which chat.json does not list",
    ]);
  });

  it("rejects a component without a contract", () => {
    expect(checkContracts([file("Badge/Badge.css", ".a {}")], index, root)).toEqual([
      "Badge: has no Component Contract at docs/components/badge.json",
    ]);
  });
});
