// Checks that the token values a Component Contract documents are the values tokens/*.json resolves to, in every mode.
import { modes } from "./model.ts";
import type { Resolved } from "./resolve.ts";

// A contract token in the shape docs/components/component-contract.schema.json allows: light+dark, value, or alias.
export interface ContractToken {
  name: string;
  type: string;
  light?: string;
  dark?: string;
  value?: string | number;
  alias?: string;
}

export interface Contract {
  component: string;
  tokens: ContractToken[];
}

// The contract records values as Pen variables hold them: dimensions as px numbers and a font family as its primary
// family. Returns the resolved value in that form, or undefined when it has none.
function documented(type: string, value: unknown): string | number | undefined {
  switch (type) {
    case "color":
      return (value as { hex?: string } | undefined)?.hex;
    case "dimension": {
      const v = value as { value: number; unit: string } | undefined;
      return v?.unit === "px" ? v.value : undefined;
    }
    case "fontFamily":
      return ([] as unknown[]).concat(value)[0] as string | undefined;
    default:
      return value as string | number | undefined;
  }
}

export function checkContract(contract: Contract, resolved: Map<string, Resolved>, source: string): string[] {
  const failures: string[] = [];
  const fail = (name: string, message: string) => failures.push(`${source}: ${name} ${message}`);
  for (const t of contract.tokens) {
    const token = resolved.get(t.name);
    if (!token) {
      fail(t.name, "is not declared in tokens/*.json");
      continue;
    }
    if (token.token.type !== t.type) {
      fail(t.name, `has type ${t.type} in the contract but ${token.token.type} in tokens/*.json`);
      continue;
    }
    for (const mode of modes) {
      const actual = token.modes[mode];
      if (t.alias !== undefined) {
        const target = actual.reference ?? "nothing";
        if (target !== t.alias) fail(t.name, `aliases ${t.alias} in the contract but references ${target} in ${mode}`);
        continue;
      }
      const expected = JSON.stringify(t.value ?? t[mode]);
      const value = JSON.stringify(documented(t.type, actual.value) ?? actual.value);
      if (value !== expected) fail(t.name, `is ${expected} in the contract but ${value} in ${mode}`);
    }
  }
  // A component token the contract does not document is drift in the other direction.
  const listed = new Set(contract.tokens.map((t) => t.name));
  const prefix = `${contract.component.toLowerCase()}.`;
  for (const { token } of resolved.values()) {
    if (token.tier === "component" && token.name.startsWith(prefix) && !listed.has(token.name)) {
      fail(token.name, "is declared in tokens/*.json but not documented in the contract");
    }
  }
  return failures;
}
