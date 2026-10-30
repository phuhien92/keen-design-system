// Checks that the tokens a Component Contract binds exist in tokens/*.json with a type that fits the bound property.
// The contract names tokens and never copies their values, so the token files are the only place a value lives.
import type { Resolved } from "./resolve.ts";

export interface Part {
  part: string;
  element: string;
  slot?: boolean;
  drawn?: boolean;
  description: string;
  elements?: { name: string; description: string }[];
}

export interface Binding {
  part: string;
  element?: string;
  property: string;
  state?: string;
  token: string;
  drawn?: boolean;
}

export interface Contract {
  component: string;
  anatomy: Part[];
  bindings: Binding[];
  contrast?: { foreground: string; background: string; minimum: number }[];
}

// The token type each bindable property takes. The names are CSS properties, so code reads them as written.
export const propertyTypes: Record<string, string> = {
  background: "color",
  color: "color",
  "border-color": "color",
  "divider-color": "color",
  radius: "dimension",
  padding: "dimension",
  "padding-block": "dimension",
  "padding-block-start": "dimension",
  "padding-block-end": "dimension",
  "padding-inline": "dimension",
  "padding-inline-start": "dimension",
  "padding-inline-end": "dimension",
  gap: "dimension",
  "max-width": "dimension",
  "min-height": "dimension",
  width: "dimension",
  height: "dimension",
  "font-family": "fontFamily",
  "font-size": "dimension",
  "font-weight": "fontWeight",
  "line-height": "number",
};

export const describeBinding = (b: Binding) =>
  `${b.part}${b.element ? `.${b.element}` : ""} ${b.property}${b.state ? ` (${b.state})` : ""} → ${b.token}`;

export function checkContract(contract: Contract, resolved: Map<string, Resolved>, source: string): string[] {
  const failures: string[] = [];
  const fail = (message: string) => failures.push(`${source}: ${message}`);
  const typeOf = (name: string) => resolved.get(name)?.token.type;
  for (const b of contract.bindings) {
    const type = typeOf(b.token);
    if (!type) fail(`binding ${describeBinding(b)} names a token tokens/*.json does not declare`);
    else if (propertyTypes[b.property] && type !== propertyTypes[b.property]) {
      fail(`binding ${describeBinding(b)} binds a ${type} token to ${b.property}, which takes ${propertyTypes[b.property]}`);
    }
  }
  for (const p of contract.contrast ?? []) {
    for (const name of [p.foreground, p.background]) {
      if (typeOf(name) !== "color")
        fail(`contrast pair ${p.foreground} on ${p.background} names ${name}, which is not a declared color token`);
    }
  }
  // A component token nothing binds is a value the component never uses, or a binding the contract forgot.
  const bound = new Set(contract.bindings.map((b) => b.token));
  const prefix = `${contract.component.toLowerCase()}.`;
  for (const { token } of resolved.values()) {
    if (token.tier === "component" && token.name.startsWith(prefix) && !bound.has(token.name)) {
      fail(`${token.name} is declared in tokens/*.json but no binding in the contract uses it`);
    }
  }
  return failures;
}
