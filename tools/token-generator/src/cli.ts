// keen token generator.
//   node tools/token-generator/src/cli.ts build           regenerate every output from tokens/*.json and design/keen.pen
//   node tools/token-generator/src/cli.ts verify <tier>   run the fast, build, or live verification gates; --strict fails on a skip
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runGates, type Tier } from "./gates.ts";
import { formatIssue, generate, readExtras, readSources, repoRoot } from "./pipeline.ts";

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
} else {
  console.error("usage: cli.ts build | verify <fast|build|live> [--strict]");
  process.exit(2);
}
