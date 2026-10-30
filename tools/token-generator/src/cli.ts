// keen token generator.
//   node tools/token-generator/src/cli.ts build           regenerate every output from tokens/*.json and design/keen.pen
//   node tools/token-generator/src/cli.ts verify <tier>   run the fast, build, or live verification gates; --strict fails on a skip
//   node tools/token-generator/src/cli.ts new-component <Name>   scaffold a component's contract, code, story, and test
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runGates, type Tier } from "./gates.ts";
import { formatIssue, generate, readExtras, readSources, repoRoot } from "./pipeline.ts";
import { scaffoldComponent } from "./scaffold.ts";

const [command, arg] = process.argv.slice(2);

if (command === "build") {
  const { files, issues } = generate(readSources(repoRoot), readExtras(repoRoot));
  if (issues.length > 0) {
    for (const issue of issues) console.error(formatIssue(issue));
    process.exit(1);
  }
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repoRoot, file)), { recursive: true });
    writeFileSync(join(repoRoot, file), content);
    console.log(`wrote ${file}`);
  }
} else if (command === "verify" && (arg === "fast" || arg === "build" || arg === "live")) {
  const strict = process.argv.includes("--strict");
  process.exit((await runGates(repoRoot, arg as Tier, (line) => console.log(line), { strict })) ? 0 : 1);
} else if (command === "new-component" && arg) {
  const scaffold = scaffoldComponent(repoRoot, arg);
  if ("error" in scaffold) {
    console.error(scaffold.error);
    process.exit(1);
  }
  for (const [file, content] of Object.entries(scaffold.files)) {
    mkdirSync(dirname(join(repoRoot, file)), { recursive: true });
    writeFileSync(join(repoRoot, file), content);
    console.log(`wrote ${file}`);
  }
  console.log(`\nNext:\n${scaffold.next.map((step, i) => `${i + 1}. ${step}`).join("\n")}`);
} else {
  console.error("usage: cli.ts build | verify <fast|build|live> [--strict] | new-component <Name>");
  process.exit(2);
}
