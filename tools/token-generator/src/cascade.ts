// A minimal model of how Keen's custom properties cascade on a page: the root element, and a [data-keen-mode]
// element directly inside it. Enough to check where a host's overrides land without a browser.
import { modes } from "./model.ts";

export type Context = "root" | (typeof modes)[number];
export const contexts: Context[] = ["root", ...modes];

export interface StyleRule {
  selectors: string[];
  declarations: [string, string][];
}

const conditional = /^@(media|supports|container)\b/;

// Style rules in source order, with quotes and whitespace removed from selectors. Rules inside conditional at-rules
// are skipped, since whether they apply depends on the environment.
export function styleRules(css: string): StyleRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: StyleRule[] = [];
  const open: { prelude: string; nested: boolean }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (open.length > 0) open[open.length - 1].nested = true;
      open.push({ prelude: (text.slice(start, i).split(";").pop() ?? "").trim(), nested: false });
      start = i + 1;
    } else if (text[i] === "}") {
      const block = open.pop();
      if (block && !block.nested && !block.prelude.startsWith("@") && !open.some((b) => conditional.test(b.prelude))) {
        rules.push({
          selectors: block.prelude.split(",").map((s) => s.replace(/["'\s]/g, "")),
          declarations: text
            .slice(start, i)
            .split(";")
            .flatMap((d): [string, string][] => {
              const colon = d.indexOf(":");
              return colon > 0 ? [[d.slice(0, colon).trim(), d.slice(colon + 1).trim()]] : [];
            }),
        });
      }
      start = i + 1;
    }
  }
  return rules;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, "#$1$1$2$2$3$3");

// The computed --keen-* custom properties in a context, with var() references substituted. :root and attribute
// selectors share a specificity, so later declarations win; cascade layers are ignored, since only Keen and its
// hosts declare --keen-* properties.
export function keenProperties(css: string, context: Context): Map<string, string> {
  const rules = styleRules(css);
  const declared = (selector: string) => {
    const own = new Map<string, string>();
    for (const rule of rules)
      if (rule.selectors.includes(selector))
        for (const [name, value] of rule.declarations) if (name.startsWith("--keen-")) own.set(name, value);
    return own;
  };
  const computeAt = (own: Map<string, string>, parent: Map<string, string>) => {
    const compute = (name: string, seen: Set<string>): string | undefined => {
      const value = own.get(name);
      if (value === undefined) return parent.get(name);
      if (seen.has(name)) return undefined;
      return value.replace(/var\((--[\w-]+)\)/g, (_, ref: string) => compute(ref, new Set([...seen, name])) ?? "");
    };
    const computed = new Map(parent);
    for (const name of own.keys()) computed.set(name, normalize(compute(name, new Set()) ?? ""));
    return computed;
  };
  const root = computeAt(declared(":root"), new Map());
  return context === "root" ? root : computeAt(declared(`[data-keen-mode=${context}]`), root);
}
