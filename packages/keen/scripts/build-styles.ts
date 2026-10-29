// Writes dist/styles.css: the generated token stylesheet, then every component's stylesheet in folder order.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const src = new URL("../src/", import.meta.url);
const parts = [readFileSync(new URL("tokens/tokens.css", src), "utf8")];
const components = new URL("components/", src);
if (existsSync(components)) {
  for (const name of readdirSync(components).sort()) {
    const css = new URL(`${name}/${name}.css`, components);
    if (existsSync(css)) parts.push(readFileSync(css, "utf8"));
  }
}
writeFileSync(new URL("../dist/styles.css", import.meta.url), parts.join("\n"));
