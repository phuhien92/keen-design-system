// Installs this fixture's locked dependencies with npm, then the packed @keen/design-system tarball, the way a host
// installs a pinned build. npm keeps the fixture outside the pnpm workspace, so the package is never a workspace link.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pack } from "../../../tools/token-generator/src/package.ts";

const fixture = fileURLToPath(new URL("../", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const tarball = pack(root);
execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: fixture, stdio: "inherit" });
execFileSync("npm", ["install", "--no-save", "--no-audit", "--no-fund", tarball], { cwd: fixture, stdio: "inherit" });
