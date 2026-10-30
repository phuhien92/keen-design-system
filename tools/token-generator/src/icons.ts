// Icons come from the design: every icon node in design/keen.pen generates the snapshot in .keen/design/icons.json,
// the Lucide registry, and the icons doc's glyph table. pnpm tokens:build reads the nodes from the file itself; the
// icons-live gate reads them again through the pen CLI, when one is signed in, to confirm Pen sees the same icons.
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Issue } from "./model.ts";
import { layers, type PenNode, runPen } from "./pen.ts";

export const iconSnapshotFile = ".keen/design/icons.json";
export const registryFile = "packages/keen/src/icons/registry.ts";

export interface IconSnapshot {
  design: string;
  glyphs: { glyph: string; library: string; layers: string[]; sizes: number[] }[];
}

type IconNode = { glyph: string; library: string; layer: string; size: number };

// lucide-react names each glyph's component in PascalCase: clock-4 is Clock4.
export const componentName = (glyph: string) =>
  glyph
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

export function lucideComponents(root: string): Set<string> {
  const require = createRequire(join(root, "packages/keen/package.json"));
  return new Set(Object.keys(require("lucide-react")));
}

// Groups icon nodes by glyph, in a stable order, so the same design always gives the same snapshot.
function snapshotOf(design: string, nodes: IconNode[]): IconSnapshot {
  const byGlyph = new Map<string, IconSnapshot["glyphs"][number]>();
  for (const node of nodes) {
    const key = `${node.library}:${node.glyph}`;
    const entry = byGlyph.get(key) ?? { glyph: node.glyph, library: node.library, layers: [], sizes: [] };
    if (!entry.layers.includes(node.layer)) entry.layers.push(node.layer);
    if (!entry.sizes.includes(node.size)) entry.sizes.push(node.size);
    byGlyph.set(key, entry);
  }
  const glyphs = [...byGlyph.values()]
    .map((g) => ({ ...g, layers: g.layers.sort(), sizes: g.sizes.sort((a, b) => a - b) }))
    .sort((a, b) => (a.glyph < b.glyph ? -1 : a.glyph > b.glyph ? 1 : a.library < b.library ? -1 : 1));
  return { design, glyphs };
}

// Reads every icon node from the design file's JSON. This is what pnpm tokens:build uses.
export function iconsFromDesign(text: string, design: string): IconSnapshot {
  const nodes: IconNode[] = [];
  for (const { node } of layers(JSON.parse(text) as { children?: PenNode[] })) {
    if (node.type === "icon") {
      nodes.push({ glyph: String(node.icon), library: String(node.library), layer: String(node.name), size: Number(node.width) });
    }
  }
  return snapshotOf(design, nodes);
}

// Reads every icon node through the pen CLI, for the icons-live cross-check.
export function readDesignIcons(
  root: string,
  design: string,
): { ok: true; snapshot: IconSnapshot } | { ok: false; error: string; unavailable: boolean } {
  const read = runPen(
    join(root, design),
    'const out=[];Get(n=>{if(n.type==="icon")out.push({glyph:n.icon,library:n.library,layer:n.name,size:n.width})});Emit(out)',
  );
  if (!read.ok) return read;
  return { ok: true, snapshot: snapshotOf(design, read.value as IconNode[]) };
}

export const serializeSnapshot = (snapshot: IconSnapshot) => `${JSON.stringify(snapshot, null, 2)}\n`;

// Generation fails when the design uses another icon family or a glyph Lucide does not have.
export function iconIssues(snapshot: IconSnapshot, lucide: Set<string>): Issue[] {
  return snapshot.glyphs.flatMap((g) => {
    const token = `icon ${g.glyph}`;
    if (g.library !== "lucide")
      return [{ rule: "icon", token, message: `uses icon family ${g.library} in ${g.layers.join(", ")}; Keen uses Lucide only` }];
    if (!lucide.has(componentName(g.glyph)))
      return [{ rule: "icon", token, message: `is not a Lucide glyph (used in ${g.layers.join(", ")})` }];
    return [];
  });
}

export function emitRegistry(snapshot: IconSnapshot): string {
  const glyphs = snapshot.glyphs.map((g) => g.glyph);
  return [
    `// Generated from the icon nodes in ${snapshot.design} by tools/token-generator. Do not edit; add an icon in the design`,
    "// and run pnpm tokens:build. This is the only module that imports from Lucide.",
    `import { ${glyphs.map(componentName).sort().join(", ")} } from "lucide-react";`,
    "",
    "export const iconRegistry = {",
    ...glyphs.map((g) => `  ${JSON.stringify(g)}: ${componentName(g)},`),
    "} as const;",
    "",
    "export type IconName = keyof typeof iconRegistry;",
    "",
  ].join("\n");
}

export function iconsDocTable(snapshot: IconSnapshot): string {
  return [
    "| Glyph | Lucide component | Design layers | Design sizes |",
    "| --- | --- | --- | --- |",
    ...snapshot.glyphs.map(
      (g) => `| \`${g.glyph}\` | \`${componentName(g.glyph)}\` | ${g.layers.join(", ")} | ${g.sizes.map((s) => `${s}px`).join(", ")} |`,
    ),
  ].join("\n");
}
