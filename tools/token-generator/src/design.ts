// Checks design/keen.pen: its layers use only token variables, and they match what each Component Contract binds.
import { type Binding, type Contract, describeBinding } from "./contract.ts";
import { layerPath, layers, type PenNode, type PenVariable } from "./pen.ts";

export interface Pen {
  children?: PenNode[];
  variables: Record<string, PenVariable>;
}

const hex = /^#[0-9A-Fa-f]{3,8}$/;
// Keys whose strings are text or identifiers, never style values.
const textKeys = new Set(["id", "name", "content", "ref", "icon", "library", "type"]);

// Every style value on a layer, including the overrides an instance applies to the layers of its component.
function* styleValues(node: PenNode): Generator<{ where: string; value: string }> {
  function* strings(value: unknown, where: string): Generator<{ where: string; value: string }> {
    if (typeof value === "string") yield { where, value };
    else if (Array.isArray(value)) for (const item of value) yield* strings(item, where);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, `${where}.${k}`);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "children" || key === "metadata" || textKeys.has(key)) continue;
    if (key === "descendants") {
      for (const [id, override] of Object.entries(value as Record<string, Record<string, unknown>>)) {
        for (const [k, v] of Object.entries(override)) if (!textKeys.has(k)) yield* strings(v, `override ${id}.${k}`);
      }
      continue;
    }
    yield* strings(value, key);
  }
}

// The variables whose value is this color in some mode, so a failure can say which variable to use.
function variablesWithColor(variables: Record<string, PenVariable>, color: string): string[] {
  return Object.entries(variables)
    .filter(([, v]) => v.type === "color")
    .filter(([, v]) =>
      (Array.isArray(v.value) ? v.value.map((m) => m.value) : [v.value]).some((c) => String(c).toUpperCase() === color.toUpperCase()),
    )
    .map(([name]) => `$${name}`);
}

export function checkDesignVariables(pen: Pen): string[] {
  const failures: string[] = [];
  for (const { node, ancestors } of layers(pen)) {
    for (const { where, value } of styleValues(node)) {
      const at = `${layerPath(node, ancestors)}: ${where}`;
      if (hex.test(value)) {
        const use = variablesWithColor(pen.variables, value);
        failures.push(
          `${at} is the typed-in color ${value}; use ${use.length ? use.join(" or ") : "a token variable (add the token first)"}`,
        );
      } else if (value.startsWith("$") && !pen.variables[value.slice(1)]) {
        failures.push(`${at} uses ${value}, which no token declares`);
      }
    }
  }
  return failures;
}

// The link from a layer to the contract: { type: "keen-part", component, part, element?, sizes? } in its metadata.
interface PartTag {
  component: string;
  part: string;
  element?: string;
  sizes?: Record<string, string>;
}

const tagOf = (node: PenNode): PartTag | undefined => {
  const meta = node.metadata as (PartTag & { type?: string }) | undefined;
  return meta?.type === "keen-part" ? meta : undefined;
};
const tagName = (t: { part: string; element?: string }) => (t.element ? `${t.part}.${t.element}` : t.part);

// Properties a part passes down to the layers inside it, as CSS inherits them.
const inherited = new Set(["color", "font-family", "font-size", "font-weight", "line-height"]);
const direct: Record<string, string> = {
  cornerRadius: "radius",
  gap: "gap",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
};
const foreground = new Set(["text", "icon", "ellipse"]);

// The contract properties one Pen style value draws. Padding is [all], [block, inline], or [top, end, bottom, start].
function properties(key: string, value: unknown, node: PenNode, strokeWidth: unknown): { property: string; value: unknown }[] {
  if (key === "fill") return [{ property: foreground.has(node.type ?? "") ? "color" : "background", value }];
  if (key === "stroke") return [{ property: strokeWidth && typeof strokeWidth === "object" ? "divider-color" : "border-color", value }];
  if (key === "padding") {
    if (!Array.isArray(value)) return [{ property: "padding", value }];
    const [top, end, bottom = top, start = end] = value.length === 2 ? [value[0], value[1]] : value;
    return [
      ...(top === bottom
        ? [{ property: "padding-block", value: top }]
        : [
            { property: "padding-block-start", value: top },
            { property: "padding-block-end", value: bottom },
          ]),
      ...(start === end
        ? [{ property: "padding-inline", value: end }]
        : [
            { property: "padding-inline-start", value: start },
            { property: "padding-inline-end", value: end },
          ]),
    ];
  }
  return direct[key] ? [{ property: direct[key], value }] : [{ property: key, value }];
}

interface Use {
  where: string;
  node: PenNode;
  // The layers above the drawn layer, nearest last, across the instance boundary for an override.
  ancestors: PenNode[];
  property: string;
  token: string;
}

function* uses(pen: Pen): Generator<Use> {
  const definitions = new Map<string, { node: PenNode; ancestors: PenNode[] }>();
  for (const entry of layers(pen)) if (entry.node.id) definitions.set(entry.node.id, entry);
  // Sizes live in a layer's metadata, so they are read once from the layer itself, never again for an override.
  const emit = function* (
    node: PenNode,
    ancestors: PenNode[],
    style: Record<string, unknown>,
    where: string,
    sizes: boolean,
  ): Generator<Use> {
    const strokeWidth = style.strokeWidth ?? node.strokeWidth;
    for (const [key, value] of Object.entries(style)) {
      if (textKeys.has(key) || key === "children" || key === "descendants" || key === "metadata") continue;
      for (const drawn of properties(key, value, node, strokeWidth)) {
        if (typeof drawn.value === "string" && drawn.value.startsWith("$")) {
          yield { where, node, ancestors, property: drawn.property, token: drawn.value.slice(1) };
        }
      }
    }
    if (sizes) for (const [property, token] of Object.entries(tagOf(node)?.sizes ?? {})) yield { where, node, ancestors, property, token };
  };
  for (const { node, ancestors } of layers(pen)) {
    const where = layerPath(node, ancestors);
    yield* emit(node, ancestors, node, where, true);
    if (node.type !== "ref") continue;
    // An override restyles a layer of the component, so it is checked against that layer's part.
    for (const [id, override] of Object.entries((node.descendants ?? {}) as Record<string, Record<string, unknown>>)) {
      const target = definitions.get(id);
      if (!target) continue;
      yield* emit(target.node, [...ancestors, node, ...target.ancestors], override, `${where} (override of ${target.node.name})`, false);
    }
  }
}

// Checks the design against each contract: every part is drawn and linked by metadata, every token a layer uses is the
// one its part binds, and every drawn binding appears in the design.
export function checkDesignAnatomy(pen: Pen, contracts: { file: string; contract: Contract }[]): string[] {
  const failures: string[] = [];
  const byComponent = new Map(contracts.map((c) => [c.contract.component, c]));
  const tagged = new Set<string>();
  const used = new Set<Binding>();

  for (const { node, ancestors } of layers(pen)) {
    const tag = tagOf(node);
    if (!tag) continue;
    const where = layerPath(node, ancestors);
    const entry = byComponent.get(tag.component);
    const part = entry?.contract.anatomy.find((p) => p.part === tag.part);
    if (!entry) failures.push(`${where}: keen-part names component ${tag.component}, which has no contract`);
    else if (!part) failures.push(`${where}: keen-part names part ${tag.part}, which ${entry.file} does not declare`);
    else if (tag.element && !part.elements?.some((e) => e.name === tag.element)) {
      failures.push(`${where}: keen-part names element ${tagName(tag)}, which ${entry.file} does not declare`);
    } else if (part.drawn === false) failures.push(`${where}: draws ${tag.part}, which ${entry.file} marks drawn: false`);
    else tagged.add(`${tag.component}:${tagName(tag)}`);
  }

  for (const use of uses(pen)) {
    const chain = [use.node, ...[...use.ancestors].reverse()].map(tagOf).filter((t): t is PartTag => t !== undefined);
    const canvas = use.token.startsWith("canvas.");
    if (chain.length === 0) {
      if (!canvas) failures.push(`${use.where}: uses $${use.token} but draws no contract part; tag the layer with keen-part metadata`);
      continue;
    }
    if (canvas) {
      failures.push(`${use.where}: uses $${use.token} inside ${tagName(chain[0])}; canvas variables color annotations only`);
      continue;
    }
    const entry = byComponent.get(chain[0].component);
    if (!entry) continue;
    const { anatomy, bindings } = entry.contract;
    // An inherited property resolves at the nearest part that binds it, then at the component root, as CSS would.
    const candidates = inherited.has(use.property) ? [...chain, { component: chain[0].component, part: anatomy[0].part }] : [chain[0]];
    const declaring = candidates
      .map((t) => bindings.filter((b) => b.part === t.part && b.element === t.element && b.property === use.property))
      .find((found) => found.length > 0);
    const match = declaring?.find((b) => b.token === use.token);
    if (match) used.add(match);
    else if (declaring) {
      failures.push(
        `${use.where}: draws ${use.property} with $${use.token}, but ${entry.file} binds ${declaring.map(describeBinding).join(" or ")}`,
      );
    } else
      failures.push(`${use.where}: draws ${use.property} with $${use.token}, which ${entry.file} does not bind for ${tagName(chain[0])}`);
  }

  for (const { file, contract } of contracts) {
    for (const part of contract.anatomy) {
      const names = part.drawn === false ? [] : [part.part, ...(part.elements ?? []).map((e) => `${part.part}.${e.name}`)];
      for (const name of names) {
        if (!tagged.has(`${contract.component}:${name}`))
          failures.push(`${file}: ${name} is not drawn; no layer carries its keen-part metadata`);
      }
    }
    for (const b of contract.bindings) {
      if (b.drawn === false && used.has(b)) failures.push(`${file}: binding ${describeBinding(b)} is drawn but marked drawn: false`);
      if (b.drawn !== false && !used.has(b))
        failures.push(`${file}: binding ${describeBinding(b)} is not drawn; draw it or mark it drawn: false`);
    }
  }
  return failures;
}
