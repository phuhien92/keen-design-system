// pnpm new:component <Name>: the hand-written files a component starts from, named so every check links them. The
// design is not scaffolded; the design agent draws it, and pnpm verify names what is still undrawn.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Scaffold {
  // Path (relative to the repo root) to file contents, for new files and for the edited package entry point.
  files: Record<string, string>;
  next: string[];
}

const entryPoint = "packages/keen/src/react.ts";
const emptyEntry = "export {};\n";
const entryHeader = "// The ./react entry point: Keen's public React components. pnpm new:component adds each one here.";

// The names every check links: the folder and the component are PascalCase, the contract file and the token prefix
// are lower case, as contract-roles and tokens-contract expect.
export function componentPaths(name: string) {
  const file = name.toLowerCase();
  return {
    contract: `docs/components/${file}.json`,
    folder: `packages/keen/src/components/${name}`,
    test: `packages/keen/tests/components/${name}.test.tsx`,
    exports: (state: string, mode: string) => `design/exports/${file}-01-${state}-${mode}.png`,
    className: `keen-${file}`,
  };
}

const todo = (what: string) => `TODO: ${what}`;

function contract(name: string): string {
  const p = componentPaths(name);
  const json = {
    $schema: "./component-contract.schema.json",
    component: name,
    contractVersion: "0.1.0",
    status: "proposed",
    summary: todo(`what ${name} is, and what a host connects to it.`),
    design: { source: "design/keen.pen", note: todo(`anything about how the design draws ${name} that its layers cannot say.`) },
    boundary: { keen: [todo(`what Keen owns in ${name}.`)], host: [todo("what the host owns.")] },
    states: [
      {
        name: "default",
        description: todo("what the user sees."),
        announcement: todo("what a screen reader announces, or that nothing is."),
        evidence: [p.exports("default", "light"), p.exports("default", "dark")],
      },
    ],
    transitions: [],
    anatomy: [{ part: "root", element: "div", description: todo(`the root element. It carries data-keen-root.`) }],
    api: {
      types: [todo(`the props interface, such as export interface ${name}Props { … }.`)],
      props: [],
      labels: {},
      behavior: [todo(`how ${name} behaves.`)],
    },
    overrides: { componentTokens: [], variants: [], slots: [], note: todo("the customization surface: tokens, variants, and slots.") },
    bindings: [{ part: "root", property: "background", token: "color.semantic.surface" }],
    contrast: [],
    structure: [todo("the DOM structure and its order.")],
    keyboard: [{ keys: "Tab", where: "anywhere", action: todo("what keyboard focus does.") }],
    focus: [todo("where focus goes, and when.")],
    screenReader: [todo("roles, names, and announcements.")],
  };
  return `${JSON.stringify(json, null, 2)}\n`;
}

function component(name: string): Record<string, string> {
  const p = componentPaths(name);
  return {
    [`${p.folder}/${name}.tsx`]: `// ${name}. Its parts, states, props, and token bindings are in ${p.contract}. Hosts customize it through tokens,
// slots, and the props the contract names, never className or style.
export function ${name}() {
  return <div data-keen-root="" className="${p.className}" />;
}
`,
    [`${p.folder}/${name}.css`]: `/* ${name}. Read only the tokens ${p.contract} binds. */
.${p.className} {
  background: var(--keen-color-semantic-surface);
}
`,
    [`${p.folder}/${name}.stories.tsx`]: `import type { Meta, StoryObj } from "@storybook/react-vite";
import { ${name} } from "./${name}.tsx";

const meta: Meta<typeof ${name}> = { title: "Components/${name}", component: ${name} };
export default meta;

// One story per state in ${p.contract}.
export const Default: StoryObj<typeof ${name}> = {};
`,
    [p.test]: `// ${name}'s rendered markup.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ${name} } from "../../src/components/${name}/${name}.tsx";

describe("${name}", () => {
  it("marks its root, so reduced motion and theming stay scoped to Keen", () => {
    expect(renderToStaticMarkup(<${name} />)).toMatch(/^<div data-keen-root="" class="${p.className}"/);
  });
});
`,
  };
}

// Adds the component to the ./react entry point, keeping the export lines sorted.
function withExport(entry: string, name: string): string {
  const line = `export { ${name} } from "./components/${name}/${name}.tsx";`;
  const body = entry.split("\n").filter((l) => l.startsWith("export {") && l !== "export {};");
  return `${[entryHeader, ...[...body, line].sort()].join("\n")}\n`;
}

export function scaffoldComponent(root: string, name: string): Scaffold | { error: string } {
  if (!/^[A-Z][A-Za-z]+$/.test(name)) return { error: `"${name}" is not a component name; use PascalCase letters, such as Button` };
  const p = componentPaths(name);
  const taken = [p.contract, p.folder, p.test].filter((path) => existsSync(join(root, path)));
  if (taken.length > 0) return { error: `${name} already exists: ${taken.join(", ")}` };
  const entry = existsSync(join(root, entryPoint)) ? readFileSync(join(root, entryPoint), "utf8") : emptyEntry;
  return {
    files: { [p.contract]: contract(name), ...component(name), [entryPoint]: withExport(entry, name) },
    next: [
      `Write the TODO placeholders in ${p.contract}: states, anatomy, props, bindings, keyboard, focus, and screen reader.`,
      `Add any ${name.toLowerCase()}.* tokens to tokens/component.json, then run pnpm tokens:build.`,
      `Have the design agent draw each state in light and dark in design/keen.pen, tagging each part with keen-part metadata, and export ${p.exports("<state>", "<mode>")}.`,
      `Run node docs/components/contract.mjs render, then pnpm verify, pnpm contract:check, and pnpm test. Until the design is drawn, they fail on exactly that.`,
    ],
  };
}
