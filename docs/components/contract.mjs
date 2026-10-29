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

// States every contract for a component must name: the approved plans' seven plus the rate-limited and offline follow-up.
const requiredStates = { Chat: ["empty", "loading", "streaming", "completed", "error", "stopped", "error-mid-stream", "rate-limited", "offline"] };
// A transition to "previous" returns to the state that was active when its from state was entered.
const previous = "previous";
const composerLabels = { send: "Send", stop: "Stop", "send-disabled": "Send, disabled", notice: "Rate-limit notice" };
const baselinePath = ".keen/baselines/tokens.json";
const keywords = new Set(["$schema", "$id", "$ref", "$defs", "title", "description", "type", "required", "properties", "additionalProperties", "items", "enum", "pattern", "minLength", "minItems"]);

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

// The light and dark values a contract token states, in the resolved form .keen/baselines/tokens.json records.
function contractValues(token) {
  if (token.alias) return { light: { reference: token.alias }, dark: { reference: token.alias } };
  if (token.light) return { light: { value: token.light }, dark: { value: token.dark } };
  const value = token.type === "dimension" ? `${token.value}px` : String(token.value);
  return { light: { value }, dark: { value } };
}

function baselineValues(entry, token) {
  const pick = (mode) => (token.alias ? { reference: entry[mode].reference } : { value: entry[mode].value });
  return { light: pick("light"), dark: pick("dark") };
}

function resolveColor(tokens, name, mode) {
  const token = tokens.get(name);
  return token.alias ? resolveColor(tokens, token.alias, mode) : token[mode];
}

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
  const tokens = new Map(c.tokens.map((t) => [t.name, t]));
  const parts = new Set(c.anatomy.map((a) => a.part));
  const states = c.states.map((s) => s.name);
  const prefix = `${c.component.toLowerCase()}.`;

  for (const name of requiredStates[c.component] ?? []) if (!states.includes(name)) fail(`states: missing required state "${name}"`);
  if (new Set(states).size !== states.length) fail("states: duplicate state name");
  if (states.includes(previous)) fail(`states: "${previous}" is reserved for transitions`);
  for (const t of c.transitions) for (const s of [...t.from, t.to]) if (!states.includes(s) && s !== previous) fail(`transitions: unknown state "${s}"`);
  for (const s of states.slice(1)) if (!c.transitions.some((t) => t.to === s)) fail(`transitions: no transition reaches "${s}"`);
  for (const path of [c.design.source, c.design.variables, ...c.states.flatMap((s) => s.evidence)]) {
    if (!existsSync(join(root, path))) fail(`missing file ${path}`);
  }

  const baseline = new Map(readJson(join(root, baselinePath)).tokens.map((entry) => [entry.name, entry]));
  for (const t of c.tokens) {
    if (!t.name.includes(".semantic.") && !t.name.startsWith(prefix)) fail(`tokens: ${t.name} is neither semantic nor ${prefix}*`);
    const forms = [t.light !== undefined || t.dark !== undefined, t.value !== undefined, t.alias !== undefined].filter(Boolean).length;
    if (forms !== 1 || (t.light === undefined) !== (t.dark === undefined)) fail(`tokens: ${t.name} needs exactly one of light+dark, value, or alias`);
    if (t.alias && !tokens.has(t.alias)) fail(`tokens: ${t.name} aliases unknown token ${t.alias}`);
    const entry = baseline.get(t.name);
    if (!entry) fail(`tokens: ${t.name} is not a DTCG token in ${baselinePath}`);
    else if (entry.type !== t.type || JSON.stringify(baselineValues(entry, t)) !== JSON.stringify(contractValues(t))) {
      fail(`tokens: ${t.name} differs from the DTCG tokens: ${JSON.stringify({ type: entry.type, ...baselineValues(entry, t) })}`);
    }
    if (!c.bindings.some((b) => b.token === t.name)) fail(`tokens: ${t.name} is not bound to any part`);
  }
  for (const name of baseline.keys()) if (name.startsWith(prefix) && !tokens.has(name)) fail(`DTCG token ${name} has no contract token`);

  for (const b of c.bindings) {
    if (!parts.has(b.part)) fail(`bindings: unknown part "${b.part}"`);
    if (!tokens.has(b.token)) fail(`bindings: ${b.part} ${b.property} names unknown token ${b.token}`);
  }
  for (const p of c.contrast) {
    if (![p.foreground, p.background].every((name) => tokens.get(name)?.type === "color")) {
      fail(`contrast: ${p.foreground} on ${p.background} needs two color tokens`);
      continue;
    }
    for (const m of ["light", "dark"]) {
      const r = contrast(resolveColor(tokens, p.foreground, m), resolveColor(tokens, p.background, m));
      if (r < p.minimum) fail(`contrast: ${p.foreground} on ${p.background} is ${r.toFixed(2)}:1 in ${m}, below ${p.minimum}:1`);
    }
  }

  const componentTokens = c.tokens.filter((t) => t.name.startsWith(prefix)).map((t) => t.name).sort();
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
  const tokens = new Map(c.tokens.map((t) => [t.name, t]));
  const ratio = (p, mode) => contrast(resolveColor(tokens, p.foreground, mode), resolveColor(tokens, p.background, mode)).toFixed(2);
  const boundary = Array.from({ length: Math.max(c.boundary.keen.length, c.boundary.host.length) }, (_, i) => [c.boundary.keen[i], c.boundary.host[i]]);
  const tokenCell = (t, mode) => (t.alias ? `→ ${code(t.alias)}` : t.value !== undefined ? (mode === "light" ? t.value : "same") : code(t[mode]));
  return `# ${c.component} — Component Guide

> Generated from [${code(file)}](${file}) by ${code("node docs/components/contract.mjs render")}. The Component Contract ${code(file)} is authoritative: if this guide and the contract ever disagree, the contract wins. Edit the contract and regenerate; ${code("node docs/components/contract.mjs check")} fails while they differ.

**Status:** ${c.status} · contract ${c.contractVersion}

${c.summary}

**Design:** [${code(c.design.source)}](${rel(c.design.source)}), with its Pen variables, generated from the DTCG tokens, read back into [${code(c.design.variables)}](${rel(c.design.variables)}). ${c.design.note}

## Host boundary

${table(["Keen owns", "The host owns"], boundary)}

## States

${table(["State", "What the user sees", "Composer", "Partial response", "Announcement", "Design"], c.states.map((s) => [
    code(s.name), s.description, composerLabels[s.composer], s.partialResponse, s.announcement,
    s.evidence.map((p) => `[${p.match(/(light|dark)\.png$/)?.[1] ?? p}](${rel(p)})`).join(" · "),
  ]))}

${table(["From", "Event", "To"], c.transitions.map((t) => [t.from.map(code).join(", "), t.event, t.to === previous ? "the state it interrupted" : code(t.to)]))}

## Anatomy

${table(["Part", "Element", "Pen layer", "Description"], c.anatomy.map((a) => [code(a.part) + (a.slot ? " (slot)" : ""), code(a.element), a.layer ?? "not drawn", a.description]))}

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

Values resolved from the DTCG token files (\`tokens/*.json\`), the only token source. \`contract.mjs check\` fails if this table and the tokens differ.

${table(["Token", "Type", "Light", "Dark", "Intended use"], c.tokens.map((t) => [code(t.name), t.type, tokenCell(t, "light"), tokenCell(t, "dark"), t.description]))}

## Token bindings

${table(["Part", "Property", "Token"], c.bindings.map((b) => [code(b.part), b.property, code(b.token)]))}

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
