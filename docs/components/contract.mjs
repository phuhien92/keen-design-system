#!/usr/bin/env node
// Checks Keen Component Contracts (docs/components/<name>.json) and renders their Component Guides (<name>.md).
//   node docs/components/contract.mjs check    validate every contract and fail if a guide is stale
//   node docs/components/contract.mjs render   rewrite every guide from its contract
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const schema = readJson(join(here, "component-contract.schema.json"));
// Token values and descriptions come from the generated baseline, so a contract never copies them.
const baselineFile = ".keen/baselines/tokens.json";
const baseline = new Map(readJson(join(root, baselineFile)).tokens.map((t) => [t.name, t]));

// A transition to "previous" returns to the state that was active when its from state was entered.
const previous = "previous";
const composerLabels = { send: "Send", stop: "Stop", "send-disabled": "Send, disabled", notice: "Rate-limit notice" };
const keywords = new Set(["$schema", "$id", "$ref", "$defs", "title", "description", "examples", "type", "required", "properties", "additionalProperties", "items", "enum", "pattern", "minLength", "minItems"]);

function checkKeywords(node, path) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (!keywords.has(key)) throw new Error(`schema ${path}: unsupported keyword "${key}"`);
    if (key === "properties" || key === "$defs") Object.entries(value).forEach(([k, v]) => checkKeywords(v, `${path}/${key}/${k}`));
    else if (key === "items" || key === "additionalProperties") checkKeywords(value, `${path}/${key}`);
  }
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value;
}

function validate(node, value, path, errors) {
  if (node.$ref) return validate(schema.$defs[node.$ref.replace("#/$defs/", "")], value, path, errors);
  const type = typeOf(value);
  if (node.type && ![].concat(node.type).some((t) => t === type || (t === "number" && type === "integer"))) {
    return errors.push(`${path}: expected ${[].concat(node.type).join(" or ")}, got ${type}`);
  }
  if (node.enum && !node.enum.includes(value)) errors.push(`${path}: must be one of ${node.enum.join(", ")}`);
  if (node.pattern && !new RegExp(node.pattern).test(value)) errors.push(`${path}: "${value}" does not match ${node.pattern}`);
  if (node.minLength && value.length < node.minLength) errors.push(`${path}: must not be empty`);
  if (type === "array") {
    if (node.minItems && value.length < node.minItems) errors.push(`${path}: needs at least ${node.minItems} item(s)`);
    if (node.items) value.forEach((item, i) => validate(node.items, item, `${path}[${i}]`, errors));
  }
  if (type === "object") {
    for (const key of node.required ?? []) if (!(key in value)) errors.push(`${path}: missing "${key}"`);
    for (const [key, item] of Object.entries(value)) {
      if (node.properties?.[key]) validate(node.properties[key], item, `${path}.${key}`, errors);
      else if (node.additionalProperties === false) errors.push(`${path}: unexpected "${key}"`);
      else if (typeof node.additionalProperties === "object") validate(node.additionalProperties, item, `${path}.${key}`, errors);
    }
  }
}

// The tokens a contract uses, in the order its bindings first name them.
const boundTokens = (c) => [...new Set(c.bindings.map((b) => b.token))];
// The same form as the generator's describeBinding: part.element property (state).
const bindingKey = (b) => `${b.part}${b.element ? `.${b.element}` : ""} ${b.property}${b.state ? ` (${b.state})` : ""}`;

function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function crossCheck(c, errors) {
  const fail = (message) => errors.push(message);
  const parts = new Map(c.anatomy.map((a) => [a.part, a]));
  const states = c.states.map((s) => s.name);
  const prefix = `${c.component.toLowerCase()}.`;

  if (new Set(states).size !== states.length) fail("states: duplicate state name");
  for (const s of c.states) {
    for (const mode of ["light", "dark"]) if (!s.evidence.some((p) => p.endsWith(`-${mode}.png`))) fail(`states: ${s.name} has no ${mode} design export`);
  }
  if (states.includes(previous)) fail(`states: "${previous}" is reserved for transitions`);
  for (const t of c.transitions) for (const s of [...t.from, t.to]) if (!states.includes(s) && s !== previous) fail(`transitions: unknown state "${s}"`);
  for (const s of states.slice(1)) if (!c.transitions.some((t) => t.to === s)) fail(`transitions: no transition reaches "${s}"`);
  for (const path of [c.design.source, ...c.states.flatMap((s) => s.evidence)]) {
    if (!existsSync(join(root, path))) fail(`missing file ${path}`);
  }

  // Whether each bound token exists, has the right type, and is drawn is checked by pnpm verify against the token files
  // and the design. This checks the contract against itself, plus that the baseline it renders values from has the token.
  const bindings = new Set();
  for (const b of c.bindings) {
    const part = parts.get(b.part);
    if (!part) fail(`bindings: unknown part "${b.part}"`);
    else if (b.element && !part.elements?.some((e) => e.name === b.element)) fail(`bindings: ${b.part} has no element "${b.element}"`);
    if (bindings.has(bindingKey(b))) fail(`bindings: ${bindingKey(b)} is bound twice`);
    bindings.add(bindingKey(b));
    if (!b.token.includes(".semantic.") && !b.token.startsWith(prefix)) fail(`bindings: ${b.token} is neither semantic nor ${prefix}*`);
    if (!baseline.has(b.token)) fail(`bindings: ${b.token} is not in ${baselineFile}; run pnpm tokens:build`);
  }
  const bound = new Set(boundTokens(c));
  for (const p of c.contrast) {
    for (const name of [p.foreground, p.background]) if (!bound.has(name)) fail(`contrast: ${name} is not bound to any part`);
  }

  const componentTokens = [...bound].filter((t) => t.startsWith(prefix)).sort();
  if (JSON.stringify([...c.overrides.componentTokens].sort()) !== JSON.stringify(componentTokens)) {
    fail(`overrides.componentTokens must list exactly the ${prefix}* tokens: ${componentTokens.join(", ")}`);
  }
  const slotParts = c.anatomy.filter((a) => a.slot).map((a) => a.part).sort();
  if (JSON.stringify([...c.overrides.slots].sort()) !== JSON.stringify(slotParts)) fail("overrides.slots must match the anatomy parts marked slot");
  const props = c.api.props.map((p) => p.name);
  for (const slot of c.overrides.slots) if (!props.includes(slot)) fail(`api: slot "${slot}" has no prop`);
  for (const banned of ["className", "style"]) if (props.includes(banned)) fail(`api: ${banned} is not a supported override point`);
  for (const [, key] of JSON.stringify(c).matchAll(/\blabels\.([A-Za-z]+)/g)) if (!(key in c.api.labels)) fail(`labels.${key} is not in api.labels`);
}

const esc = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (value) => `\`${value}\``;
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
const list = (items) => items.map((item) => `- ${item}`).join("\n");
const rel = (path) => `../../${path}`;

function render(c, file) {
  const ratio = (p, mode) => contrast(baseline.get(p.foreground)[mode].value, baseline.get(p.background)[mode].value).toFixed(2);
  const boundary = Array.from({ length: Math.max(c.boundary.keen.length, c.boundary.host.length) }, (_, i) => [c.boundary.keen[i], c.boundary.host[i]]);
  // A token that aliases another bound token shows the alias; one that resolves to a primitive shows its value.
  const tokenCell = (t, mode) => {
    const { reference, value } = t[mode];
    if (reference && !reference.includes(".primitive.")) return `→ ${code(reference)}`;
    return mode === "dark" && t.type !== "color" && value === t.light.value ? "same" : code(value);
  };
  const partCell = (a) => code(a.part) + (a.slot ? " (slot)" : "") + (a.drawn === false ? " (not drawn)" : "");
  return `# ${c.component} — Component Guide

> Generated from [${code(file)}](${file}) by ${code("node docs/components/contract.mjs render")}. The Component Contract ${code(file)} is authoritative: if this guide and the contract ever disagree, the contract wins. Edit the contract and regenerate; ${code("node docs/components/contract.mjs check")} fails while they differ.

**Status:** ${c.status} · contract ${c.contractVersion}

${c.summary}

**Design:** [${code(c.design.source)}](${rel(c.design.source)}). ${c.design.note}

## Host boundary

${table(["Keen owns", "The host owns"], boundary)}

## States

${table(["State", "What the user sees", "Composer", "Partial response", "Announcement", "Design"], c.states.map((s) => [
    code(s.name), s.description, composerLabels[s.composer], s.partialResponse, s.announcement,
    s.evidence.map((p) => `[${p.match(/(light|dark)\.png$/)?.[1] ?? p}](${rel(p)})`).join(" · "),
  ]))}

${table(["From", "Event", "To"], c.transitions.map((t) => [t.from.map(code).join(", "), t.event, t.to === previous ? "the state it interrupted" : code(t.to)]))}

## Anatomy

${table(["Part", "Element", "Elements", "Description"], c.anatomy.map((a) => [partCell(a), code(a.element), (a.elements ?? []).map((e) => code(e.name)).join(", "), a.description]))}

Each layer that draws a part carries ${code('{ "type": "keen-part", "component", "part", "element" }')} metadata in the design, so the link survives a renamed layer.

## API

\`\`\`ts
${c.api.types.join("\n")}
\`\`\`

${table(["Prop", "Type", "Default", "Description"], c.api.props.map((p) => [code(p.name), code(p.type), p.required ? "required" : p.default ? code(p.default) : "", p.description]))}

Default labels (${code("api.labels")}):

${table(["Key", "Default"], Object.entries(c.api.labels).map(([k, v]) => [code(k), v]))}

${list(c.api.behavior)}

## Customization

- **Component tokens:** ${c.overrides.componentTokens.map(code).join(", ")}
- **Variants:** ${c.overrides.variants.length ? c.overrides.variants.map((v) => code(JSON.stringify(v))).join(", ") : "none"}
- **Slots:** ${c.overrides.slots.map(code).join(", ")}

${c.overrides.note}

## Tokens

Every token the bindings use. Values and descriptions come from ${code(baselineFile)}, which ${code("pnpm tokens:build")} generates from ${code("tokens/*.json")}.

${table(["Token", "Type", "Light", "Dark", "Intended use"], boundTokens(c).map((name) => baseline.get(name)).map((t) => [code(t.name), t.type, tokenCell(t, "light"), tokenCell(t, "dark"), t.description]))}

## Token bindings

Properties are CSS properties; ${code("divider-color")} is a one-sided border. A binding without an element styles the part itself, and color and type properties are inherited by the layers inside it.

${table(["Part", "Element", "Property", "State", "Token", "Design"], c.bindings.map((b) => [code(b.part), b.element ? code(b.element) : "", b.property, b.state ?? "", code(b.token), b.drawn === false ? "not drawn" : "drawn"]))}

## Contrast

${table(["Foreground", "Background", "Minimum", "Light", "Dark"], c.contrast.map((p) => [code(p.foreground), code(p.background), `${p.minimum}:1`, `${ratio(p, "light")}:1`, `${ratio(p, "dark")}:1`]))}

## Structure

${list(c.structure)}

## Keyboard

${table(["Keys", "Where", "Action"], c.keyboard.map((k) => [k.keys, k.where, k.action]))}

## Focus

${list(c.focus)}

## Screen reader

${list(c.screenReader)}
`;
}

checkKeywords(schema, "#");
const mode = process.argv[2];
if (mode !== "check" && mode !== "render") {
  console.error("usage: node docs/components/contract.mjs check|render");
  process.exit(2);
}
let failed = false;
for (const file of readdirSync(here).filter((f) => f.endsWith(".json") && f !== "component-contract.schema.json").sort()) {
  const contract = readJson(join(here, file));
  const errors = [];
  validate(schema, contract, file, errors);
  if (!errors.length) crossCheck(contract, errors);
  const guide = join(here, file.replace(/\.json$/, ".md"));
  if (!errors.length) {
    const markdown = render(contract, file);
    if (mode === "render") writeFileSync(guide, markdown);
    else if (!existsSync(guide) || readFileSync(guide, "utf8") !== markdown) errors.push(`${file.replace(/\.json$/, ".md")} is stale; run: node docs/components/contract.mjs render`);
  }
  for (const e of errors) console.error(`✗ ${e}`);
  console.log(errors.length ? `✗ ${file}: ${errors.length} problem(s)` : `✓ ${file}`);
  failed ||= errors.length > 0;
}
process.exit(failed ? 1 : 0);
