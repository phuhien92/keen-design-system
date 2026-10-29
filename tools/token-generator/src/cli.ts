// keen token generator.
//   node tools/token-generator/src/cli.ts build           regenerate every output from tokens/*.json
//   node tools/token-generator/src/cli.ts verify <tier>   run the fast, build, or live verification gates
//   node tools/token-generator/src/cli.ts design-push     regenerate the Pen variables in design/keen.pen (needs a signed-in pen CLI)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runGates, type Tier } from "./gates.ts";
import { designFile, normalize, type PenVariables, penVariables, serializeVariables, variablesFile, writePenVariables } from "./pen.ts";
import { formatIssue, type Generation, generate, readSources, repoRoot } from "./pipeline.ts";

const [command, arg] = process.argv.slice(2);

function validGeneration(): Generation {
  const generation = generate(readSources(repoRoot));
  if (generation.issues.length > 0) {
    for (const issue of generation.issues) console.error(formatIssue(issue));
    process.exit(1);
  }
  return generation;
}

if (command === "build") {
  for (const [file, content] of Object.entries(validGeneration().files)) {
    mkdirSync(dirname(join(repoRoot, file)), { recursive: true });
    writeFileSync(join(repoRoot, file), content);
    console.log(`wrote ${file}`);
  }
} else if (command === "verify" && (arg === "fast" || arg === "build" || arg === "live")) {
  process.exit(runGates(repoRoot, arg as Tier, (line) => console.log(line)) ? 0 : 1);
} else if (command === "design-push") {
  const expected = penVariables(validGeneration().tokens);
  const written = writePenVariables(join(repoRoot, designFile), expected);
  if (!written.ok) {
    console.error(`could not write the Pen variables: ${written.error}`);
    process.exit(1);
  }
  const readBack = normalize(written.value as PenVariables, Object.keys(expected.variables));
  if (JSON.stringify(readBack) !== JSON.stringify(expected)) {
    console.error(`the Pen variables read back from ${designFile} differ from the tokens`);
    process.exit(1);
  }
  writeFileSync(join(repoRoot, variablesFile), serializeVariables(readBack));
  console.log(`wrote ${Object.keys(readBack.variables).length} Pen variables to ${designFile} and ${variablesFile}`);
} else {
  console.error("usage: cli.ts build | verify <fast|build|live> | design-push");
  process.exit(2);
}
