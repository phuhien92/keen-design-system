// pnpm new:component, scaffolded into a copy of the repository and checked by the real gates.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { gates, runGates } from "../src/gates.ts";
import { repoRoot } from "../src/pipeline.ts";
import { scaffoldComponent } from "../src/scaffold.ts";

describe("scaffoldComponent", () => {
  it("rejects a name that is not PascalCase", () => {
    expect(scaffoldComponent(repoRoot, "button")).toEqual({
      error: '"button" is not a component name; use PascalCase letters, such as Button',
    });
  });

  it("refuses to overwrite a component that exists", () => {
    expect(scaffoldComponent(repoRoot, "Chat")).toEqual({ error: "Chat already exists: docs/components/chat.json" });
  });

  it("adds the component to the ./react entry point, keeping the exports sorted", () => {
    const scaffold = scaffoldComponent(repoRoot, "Button");
    if ("error" in scaffold) throw new Error(scaffold.error);
    expect(scaffold.files["packages/keen/src/react.ts"]).toMatch(/\nexport \{ Button \} from "\.\/components\/Button\/Button\.tsx";\n$/);
  });
});

describe("a scaffolded component", () => {
  const root = mkdtempSync(join(tmpdir(), "keen-scaffold-"));
  for (const path of ["tokens", ".keen", "docs", "design", "tools", "package.json", "packages/keen/package.json", "packages/keen/src"]) {
    cpSync(join(repoRoot, path), join(root, path), { recursive: true });
  }
  symlinkSync(join(repoRoot, "packages/keen/node_modules"), join(root, "packages/keen/node_modules"));
  const scaffold = scaffoldComponent(root, "Button");
  if ("error" in scaffold) throw new Error(scaffold.error);
  for (const [file, content] of Object.entries(scaffold.files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }

  // The pen CLI gates are slow and need a signed-in CLI; pen.test.ts and icons.test.ts cover them.
  const fast = async () => {
    const live = { pen: gates["pen-live"], icons: gates["icons-live"] };
    gates["pen-live"] = gates["icons-live"] = () => ({ status: "skip", reason: "stubbed in scaffold.test.ts" });
    try {
      const lines: string[] = [];
      const ok = await runGates(root, "fast", (line) => lines.push(line));
      return { ok, output: lines.join("\n") };
    } finally {
      gates["pen-live"] = live.pen;
      gates["icons-live"] = live.icons;
    }
  };

  it("passes every code check and fails only because the design is not drawn yet", async () => {
    const { ok, output } = await fast();
    expect(ok).toBe(false);
    expect(output.match(/^\s+FAIL .*/gm)).toEqual([expect.stringMatching(/^\s+FAIL design-anatomy:/)]);
    expect(output).toContain("docs/components/button.json: root is not drawn; no layer carries its keen-part metadata");
    for (const gate of ["component-forwarding", "token-reads", "contract-roles", "tokens-contract", "motion-usage", "icon-usage"]) {
      expect(output).toMatch(new RegExp(`PASS ${gate}:`));
    }
  });

  it("gives a contract that validates, and fails only on the design exports it names", () => {
    const check = () => {
      try {
        return execFileSync("node", ["docs/components/contract.mjs", "check"], { cwd: root, encoding: "utf8", stdio: "pipe" });
      } catch (error) {
        return `${(error as { stdout: string }).stdout}${(error as { stderr: string }).stderr}`;
      }
    };
    // Errors go to stderr and the summary to stdout, so the joined order is not meaningful.
    expect(check().match(/^✗ .*/gm)?.sort()).toEqual([
      "✗ button.json: 2 problem(s)",
      "✗ missing file design/exports/button-01-default-dark.png",
      "✗ missing file design/exports/button-01-default-light.png",
    ]);
  });

  it("does not let a contract leave proposed with TODO placeholders", () => {
    const file = join(root, "docs/components/button.json");
    writeFileSync(file, readFileSync(file, "utf8").replace('"status": "proposed"', '"status": "approved"'));
    const out = (() => {
      try {
        return execFileSync("node", ["docs/components/contract.mjs", "check"], { cwd: root, encoding: "utf8", stdio: "pipe" });
      } catch (error) {
        return `${(error as { stdout: string }).stdout}${(error as { stderr: string }).stderr}`;
      }
    })();
    expect(out).toContain("✗ status: approved with TODO placeholders left; write them, or keep it proposed");
  });
});
