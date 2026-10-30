// Source checks for the customization boundary: what component code may read and what it may forward.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

export interface SourceFile {
  path: string;
  text: string;
}

const isSource = (path: string) => /\.(tsx?|css)$/.test(path) && !/\.(test|stories)\.tsx?$/.test(path);

// Component code: every component folder and the icon module. Generated tokens are not component code.
export function componentSources(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (isSource(path)) files.push({ path: relative(root, path), text: readFileSync(path, "utf8") });
    }
  };
  for (const dir of ["packages/keen/src/components", "packages/keen/src/icons"]) walk(join(root, dir));
  return files;
}

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const domAttributeTypes = /\b(\w*HTMLAttributes|HTMLProps|DetailedHTMLProps|DOMAttributes|SVGAttributes|SVGProps|ComponentProps\w*)\b/g;

// Components forward no className or style onto internals: their props neither declare, inherit, nor destructure
// either, and JSX never spreads props.
export function checkForwarding(files: SourceFile[]): string[] {
  const failures: string[] = [];
  for (const file of files.filter((f) => /\.tsx?$/.test(f.path))) {
    const text = withoutComments(file.text);
    for (const m of text.matchAll(/(?:^|[{(,;])\s*(className|style)\??\s*:/gm))
      failures.push(`${file.path}: props declare ${m[1]}, a styling escape hatch`);
    for (const m of text.matchAll(domAttributeTypes)) failures.push(`${file.path}: props use ${m[1]}, which carries className and style`);
    for (const m of text.matchAll(/(?:\(|\b(?:const|let|var)\s+)\{[^{}]*?\b(className|style)\b[^{}]*\}/g))
      failures.push(`${file.path}: destructures ${m[1]}, a styling escape hatch`);
    if (!file.path.endsWith(".tsx")) continue;
    for (const m of text.matchAll(/\b(className|style)=\{[^}]*\b(props|rest|className|style)\b/g))
      failures.push(`${file.path}: forwards ${m[1]} from props`);
    if (/<[A-Za-z][\w.]*[^>]*\{\s*\.\.\./.test(text)) failures.push(`${file.path}: spreads props onto an element`);
  }
  return failures;
}

export interface TokenIndex {
  // CSS variable name to token name, for every token a consumer can read.
  vars: Map<string, string>;
}

// Every --keen-* read resolves to a generated token or a hook the same file declares, and never to a primitive.
export function checkReads(files: SourceFile[], index: TokenIndex): { failures: string[]; read: Set<string> } {
  const failures: string[] = [];
  const read = new Set<string>();
  for (const file of files) {
    const text = withoutComments(file.text);
    const declared = new Set([...text.matchAll(/(--keen-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const [, name] of text.matchAll(/var\(\s*(--keen-[a-z0-9-]+)/g)) {
      read.add(name);
      if (/-primitive-/.test(name)) failures.push(`${file.path}: reads primitive ${name}; components read semantic or component tokens`);
      else if (!index.vars.has(name) && !declared.has(name))
        failures.push(`${file.path}: reads ${name}, which no token generates (phantom)`);
    }
    for (const name of declared) {
      if (/-(primitive|semantic)-/.test(name) || index.vars.has(name))
        failures.push(`${file.path}: declares token ${name}; only hosts override tokens`);
    }
  }
  return { failures, read };
}

// Semantic roles and component tokens a component reads must be listed in its Component Contract.
export function checkContracts(files: SourceFile[], index: TokenIndex, root: string): string[] {
  const failures: string[] = [];
  const byComponent = new Map<string, SourceFile[]>();
  for (const file of files) {
    const m = file.path.match(/src\/components\/([^/]+)\//);
    if (m) byComponent.set(m[1], [...(byComponent.get(m[1]) ?? []), file]);
  }
  for (const [name, own] of byComponent) {
    const contractPath = join(root, "docs/components", `${name.toLowerCase()}.json`);
    if (!existsSync(contractPath)) {
      failures.push(`${name}: has no Component Contract at docs/components/${basename(contractPath)}`);
      continue;
    }
    // The tokens a component may read are the ones its contract binds to a part.
    const bound = new Set<string>(JSON.parse(readFileSync(contractPath, "utf8")).bindings.map((b: { token: string }) => b.token));
    for (const file of own) {
      for (const [, cssName] of withoutComments(file.text).matchAll(/var\(\s*(--keen-[a-z0-9-]+)/g)) {
        const token = index.vars.get(cssName);
        if (token && !bound.has(token)) failures.push(`${file.path}: reads ${token}, which ${basename(contractPath)} does not bind`);
      }
    }
  }
  return failures;
}
