// Fast-tier checks for motion, icons, and sanctioned exceptions in component code.
import type { SourceFile } from "./boundary.ts";
import { keenRoot, type MotionRegistry, reducedDuration } from "./motion.ts";

export const allowCategories = ["motion", "icon-size", "color"];
// Components animate only opacity, transform, and colors.
const animatable = new Set(["opacity", "transform", "color", "background-color", "border-color", "outline-color", "fill", "stroke"]);
const literalTime = /(^|[\s,(])-?\d*\.?\d+m?s\b/;
const literalEasing = /\b(cubic-bezier|steps)\(|\b(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b/;

// Every ds-allow directive must name a known category and give a reason.
export function checkAllowDirectives(files: SourceFile[]): string[] {
  const failures: string[] = [];
  for (const file of files) {
    for (const m of file.text.matchAll(/ds-allow\b([^\n*]*)/g)) {
      const directive = m[1].match(/^\(([^)]*)\):\s*\S/);
      if (!directive) failures.push(`${file.path}: malformed "ds-allow${m[1].trim()}"; write ds-allow(<category>): <reason>`);
      else if (!allowCategories.includes(directive[1])) {
        failures.push(`${file.path}: unknown ds-allow category "${directive[1]}"; use ${allowCategories.join(", ")}`);
      }
    }
  }
  return failures;
}

interface Declaration {
  property: string;
  value: string;
  allowed: string[];
  line: number;
}

// Declarations end at ";" or "}" and may span lines; each reports the line it starts on. Comments are removed from
// values, and a comment's ds-allow categories belong to the declaration it sits in or shares a line with.
function declarations(text: string): Declaration[] {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const lineAt = (i: number) => text.slice(0, i).split("\n").length;
  const found: (Declaration & { start: number; end: number })[] = [];
  for (const m of css.matchAll(/[^;{}]*[;{}]/g)) {
    const d = m[0].match(/^(\s*)([a-z-]+)\s*:\s*([\s\S]+?)\s*[;}]$/);
    if (!d) continue;
    const start = m.index + d[1].length;
    found.push({ property: d[2], value: d[3], allowed: [], line: lineAt(start), start, end: m.index + m[0].length });
  }
  for (const c of text.matchAll(/\/\*[\s\S]*?\*\//g)) {
    const from = c.index;
    const to = from + c[0].length;
    const sameLine = (a: number, b: number) => !text.slice(a, b).includes("\n");
    const owner =
      found.find((d) => from >= d.start && from < d.end) ??
      [...found].reverse().find((d) => d.end <= from && sameLine(d.end, from)) ??
      found.find((d) => d.start >= to && sameLine(to, d.start));
    owner?.allowed.push(...[...c[0].matchAll(/ds-allow\(([^)]*)\)/g)].map((m) => m[1]));
  }
  return found.map(({ start, end, ...d }) => d);
}

const keyframeProperties = (text: string) =>
  [...text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)].flatMap(([, name, body]) =>
    [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => ({ name, property: m[1] })),
  );

// Motion in component CSS uses a named use's duration and easing together, on animatable properties only, and every
// infinite or entrance animation is registered so reduced motion can park or drop it.
export function checkMotionUsage(
  files: SourceFile[],
  uses: Map<string, { duration: string; easing: string }>,
  registry: MotionRegistry,
): string[] {
  const failures: string[] = [];
  const pairs = new Map([...uses].map(([name, v]) => [`${v.duration} ${v.easing}`, name]));
  const loops = new Set(registry.loops.map((l) => l.keyframes));
  const entrances = new Set(registry.entrances.map((e) => e.keyframes));
  const entranceUse = uses.get("motion.semantic.use-message-enter");
  for (const file of files.filter((f) => f.path.endsWith(".css"))) {
    const at = (d: Declaration) => `${file.path}:${d.line}`;
    for (const d of declarations(file.text)) {
      if (!/^(transition|animation)(-|$)/.test(d.property)) continue;
      const sanctioned = d.allowed.includes("motion");
      const value = d.value.replace(/var\([^)]*\)/g, " ");
      if (!sanctioned && (literalTime.test(value) || literalEasing.test(value))) {
        failures.push(`${at(d)}: literal duration or easing in ${d.property}; apply a named motion use`);
        continue;
      }
      if (d.property !== "transition" && d.property !== "animation") {
        if (!sanctioned)
          failures.push(`${at(d)}: ${d.property} splits a use; write the ${d.property.split("-")[0]} shorthand with a named use`);
        continue;
      }
      for (const item of d.value.split(/,(?![^(]*\))/)) {
        const vars = [...item.matchAll(/var\((--keen-[a-z0-9-]+)\)/g)].map((m) => m[1]);
        const words = item
          .replace(/var\([^)]*\)/g, " ")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (!sanctioned && !pairs.has(vars.slice(0, 2).join(" "))) {
          failures.push(`${at(d)}: "${item.trim()}" does not apply a named motion use (a use's duration and easing, in that order)`);
        }
        if (d.property === "transition") {
          const property = words[0] ?? "";
          if (!animatable.has(property)) failures.push(`${at(d)}: transitions ${property}; animate only opacity, transform, and colors`);
        } else {
          const name = words.find((w) => w !== "infinite" && !/^\d/.test(w)) ?? "";
          if (words.includes("infinite") && !loops.has(name))
            failures.push(`${at(d)}: infinite animation ${name} is not in the loop registry`);
          if (entranceUse && vars[1] === entranceUse.easing && !entrances.has(name))
            failures.push(`${at(d)}: entrance animation ${name} is not in the entrance registry`);
        }
      }
    }
    for (const { name, property } of keyframeProperties(file.text)) {
      if (!animatable.has(property))
        failures.push(`${file.path}: @keyframes ${name} animates ${property}; animate only opacity, transform, and colors`);
    }
  }
  return failures;
}

// The reduced-motion rules: semantic durations collapse to 0.01ms, and every rule stays inside Keen's root.
export function checkReducedMotion(
  generated: string | undefined,
  durationVars: string[],
  registry: MotionRegistry,
  files: SourceFile[],
): string[] {
  if (!generated) return ["packages/keen/src/tokens/reduced-motion.css is missing; run pnpm tokens:build"];
  const failures: string[] = [];
  for (const name of durationVars) {
    if (!generated.includes(`${name}: ${reducedDuration};`)) failures.push(`reduced-motion.css does not set ${name} to ${reducedDuration}`);
  }
  if (!/scroll-behavior:\s*auto/.test(generated)) failures.push("reduced-motion.css does not set scroll-behavior: auto");
  for (const loop of registry.loops) {
    if (!generated.includes(`${keenRoot} ${loop.selector} {`))
      failures.push(`reduced-motion.css has no rule parking loop ${loop.keyframes}`);
  }
  for (const source of [
    { path: "packages/keen/src/tokens/reduced-motion.css", text: generated },
    ...files.filter((f) => f.path.endsWith(".css")),
  ]) {
    for (const block of source.text.matchAll(/@media[^{]*prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/g)) {
      const body = block[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{[^{}]*\}/g, ";");
      for (const selector of body
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (!selector.startsWith(keenRoot)) failures.push(`${source.path}: reduced-motion rule "${selector}" is not scoped to ${keenRoot}`);
      }
    }
  }
  return failures;
}

// Only the generated registry imports Lucide, and component code names only registered glyphs.
export function checkIconUsage(files: SourceFile[], registryPath: string, glyphs: Set<string>): string[] {
  const failures: string[] = [];
  for (const file of files) {
    if (file.path !== registryPath && /from\s+["']lucide-react(\/[^"']*)?["']|require\(\s*["']lucide-react/.test(file.text)) {
      failures.push(`${file.path}: imports lucide-react; only ${registryPath} may`);
    }
    for (const [, name] of file.text.matchAll(/<Icon\b[^>]*\bname=["']([^"']+)["']/g)) {
      if (!glyphs.has(name)) failures.push(`${file.path}: names icon "${name}", which the design does not use`);
    }
  }
  return failures;
}
