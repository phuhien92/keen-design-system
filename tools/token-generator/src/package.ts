// Build-tier checks of the packed @keen/design-system package and of the Astro consumer fixture.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { contexts, keenProperties, styleRules } from "./cascade.ts";

export const packageDir = "packages/keen";
export const publicExports = ["./react", "./styles.css", "./tokens"];
const allowedFiles = /^(package\.json|README\.md|LICENSE|dist\/.+)$/;

// Packs the built package into a temporary directory and returns the tarball path.
export function pack(root: string): string {
  const dir = mkdtempSync(join(tmpdir(), "keen-pack-"));
  execFileSync("pnpm", ["pack", "--pack-destination", dir], { cwd: join(root, packageDir), stdio: "pipe" });
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("pnpm pack produced no tarball");
  return join(dir, tarball);
}

// Packs the package and extracts the tarball next to it, as an install would.
export function packAndExtract(root: string): string {
  const tarball = pack(root);
  execFileSync("tar", ["-xzf", tarball, "-C", dirname(tarball)]);
  return join(dirname(tarball), "package");
}

const listFiles = (dir: string, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );

// The packed package holds only built files, exports exactly the public entry points, and refuses internals.
export function checkPackage(root: string): string[] {
  if (!existsSync(join(root, packageDir, "dist/styles.css"))) return [`${packageDir}/dist is missing; run pnpm build first`];
  const failures: string[] = [];
  const extracted = packAndExtract(root);
  for (const file of listFiles(extracted)) if (!allowedFiles.test(file)) failures.push(`packed package contains ${file}`);
  const manifest = JSON.parse(readFileSync(join(extracted, "package.json"), "utf8"));
  const exported = Object.keys(manifest.exports ?? {}).sort();
  if (JSON.stringify(exported) !== JSON.stringify(publicExports))
    failures.push(`exports ${exported.join(", ")}; expected ${publicExports.join(", ")}`);
  const tokensCss = readFileSync(join(root, packageDir, "src/tokens/tokens.css"), "utf8");
  if (!readFileSync(join(extracted, "dist/styles.css"), "utf8").includes(tokensCss))
    failures.push("dist/styles.css does not contain the generated token stylesheet");

  // Install the extracted package into a scratch consumer and import it the way a host would.
  const consumer = mkdtempSync(join(tmpdir(), "keen-consumer-"));
  mkdirSync(join(consumer, "node_modules/@keen"), { recursive: true });
  execFileSync("cp", ["-R", extracted, join(consumer, "node_modules/@keen/design-system")]);
  writeFileSync(join(consumer, "package.json"), '{ "type": "module" }\n');
  const probe = `
    const results = {};
    const tokens = await import("@keen/design-system/tokens");
    results.tokens = tokens.keenTokens.color.semantic.action;
    results.styles = import.meta.resolve("@keen/design-system/styles.css").endsWith("/dist/styles.css");
    results.react = import.meta.resolve("@keen/design-system/react").endsWith(".js");
    for (const internal of ["@keen/design-system", "@keen/design-system/dist/tokens/tokens.js", "@keen/design-system/package.json"]) {
      try { import.meta.resolve(internal); results[internal] = "importable"; } catch (e) { results[internal] = e.code; }
    }
    console.log(JSON.stringify(results));`;
  writeFileSync(join(consumer, "probe.mjs"), probe);
  const results = JSON.parse(execFileSync("node", ["probe.mjs"], { cwd: consumer, encoding: "utf8" }));
  if (results.tokens !== "var(--keen-color-semantic-action)")
    failures.push(`@keen/design-system/tokens resolved action to ${results.tokens}`);
  if (!results.styles) failures.push("@keen/design-system/styles.css does not resolve to dist/styles.css");
  if (!results.react) failures.push("@keen/design-system/react does not resolve to a module");
  for (const internal of ["@keen/design-system", "@keen/design-system/dist/tokens/tokens.js", "@keen/design-system/package.json"]) {
    if (results[internal] !== "ERR_PACKAGE_PATH_NOT_EXPORTED")
      failures.push(`${internal} is ${results[internal]}; internals must not be importable`);
  }
  return failures;
}

export const fixtureDir = "apps/fixture-astro";

// The fixture installs the packed package (not a workspace link), themes it page-wide through semantic tokens, and builds.
export function checkFixture(root: string): { skip?: string; failures: string[] } {
  const installed = join(root, fixtureDir, "node_modules/@keen/design-system");
  if (!existsSync(installed)) return { skip: `${fixtureDir} has no installed package; run pnpm fixture:install`, failures: [] };
  const failures: string[] = [];
  if (realpathSync(installed).startsWith(realpathSync(join(root, packageDir)))) {
    failures.push(`${fixtureDir} links to ${packageDir} instead of installing the packed package`);
  }
  execFileSync("pnpm", ["run", "build"], { cwd: join(root, fixtureDir), stdio: "pipe" });
  const dist = join(root, fixtureDir, "dist");
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const css = listFiles(dist)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(join(dist, f), "utf8"))
    .join("\n");
  for (const testid of ["themed-sample", "user-bubble"])
    if (!html.includes(`data-testid="${testid}"`)) failures.push(`the built page does not render ${testid}`);
  failures.push(...checkFixtureCss(css, readFileSync(join(installed, "dist/styles.css"), "utf8")));
  return { failures };
}

const themedSemantic = "--keen-color-semantic-action";
const aliasingComponent = "--keen-chat-message-user-background";

const primitiveDeclarations = (css: string) =>
  styleRules(css)
    .flatMap((rule) => rule.declarations.map(([name]) => name))
    .filter((name) => /^--keen-[a-z-]*-primitive-/.test(name))
    .sort();

// The host's built CSS includes Keen's stylesheet, overrides a semantic token page-wide in every mode context, and that
// override reaches a component token that aliases it. Hosts never redeclare a primitive.
export function checkFixtureCss(css: string, keenCss: string): string[] {
  const failures: string[] = [];
  if (!/--keen-color-primitive-blue-600:\s*#2557D6/i.test(css)) failures.push("the built CSS does not include Keen's token stylesheet");
  for (const context of contexts) {
    const host = keenProperties(css, context);
    const action = host.get(themedSemantic);
    if (action === keenProperties(keenCss, context).get(themedSemantic)) {
      failures.push(`the fixture does not override ${themedSemantic} in the ${context} context`);
    } else if (host.get(aliasingComponent) !== action) {
      failures.push(`${aliasingComponent} is ${host.get(aliasingComponent)} in the ${context} context, not the host's ${action}`);
    }
  }
  if (JSON.stringify(primitiveDeclarations(css)) !== JSON.stringify(primitiveDeclarations(keenCss))) {
    failures.push("the fixture overrides a primitive; hosts theme through semantic tokens");
  }
  return failures;
}
