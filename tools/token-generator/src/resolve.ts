// Resolves token references per mode, rejecting missing targets, type mismatches, and cycles.
import { type Issue, isReference, modes, referenceName, type Token } from "./model.ts";

export type Mode = (typeof modes)[number];

export interface Resolved {
  token: Token;
  // Per mode: the token directly referenced (if the authored value is a reference) and the final literal value.
  modes: Record<Mode, { reference?: string; value: unknown }>;
}

// Which type a reference inside a composite field must point at.
const fieldTypes: Record<string, Record<string, string>> = {
  transition: { duration: "duration", delay: "duration", timingFunction: "cubicBezier" },
};

export function resolveTokens(tokens: Token[]): { resolved: Map<string, Resolved>; issues: Issue[] } {
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const issues: Issue[] = [];
  const reported = new Set<string>();
  const report = (issue: Issue) => {
    const key = `${issue.rule}:${issue.token}:${issue.message}`;
    if (!reported.has(key)) issues.push(issue);
    reported.add(key);
  };

  const follow = (value: unknown, type: string, mode: Mode, stack: string[]): unknown => {
    if (isReference(value)) {
      const target = byName.get(referenceName(value));
      const from = stack[stack.length - 1];
      if (!target) {
        report({ rule: "reference", token: from, message: `references missing token ${value}` });
        return undefined;
      }
      if (target.type !== type) {
        report({ rule: "reference", token: from, message: `references ${target.name} of type ${target.type}, expected ${type}` });
        return undefined;
      }
      if (stack.includes(target.name)) {
        report({ rule: "cycle", token: from, message: `has a reference cycle: ${[...stack, target.name].join(" -> ")}` });
        return undefined;
      }
      return follow(target.values[mode] ?? target.values.light, type, mode, [...stack, target.name]);
    }
    const fields = fieldTypes[type];
    if (fields && typeof value === "object" && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) out[key] = follow(inner, fields[key] ?? "", mode, stack);
      return out;
    }
    return value;
  };

  const resolved = new Map<string, Resolved>();
  for (const token of tokens) {
    const entry = {} as Resolved["modes"];
    for (const mode of modes) {
      const authored = token.values[mode] ?? token.values.light;
      entry[mode] = {
        ...(isReference(authored) ? { reference: referenceName(authored) } : {}),
        value: follow(authored, token.type, mode, [token.name]),
      };
    }
    resolved.set(token.name, { token, modes: entry });
  }
  return { resolved, issues };
}
