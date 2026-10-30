// Writes dist/styles.css: the generated token stylesheet, the icon and component stylesheets in folder order, and the
// generated reduced-motion rules last, so they win over every rule before them.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const src = new URL("../src/", import.meta.url);
const parts = [readFileSync(new URL("tokens/tokens.css", src), "utf8"), readFileSync(new URL("icons/Icon.css", src), "utf8")];
const components = new URL("components/", src);
if (existsSync(components)) {
  for (const name of readdirSync(components).sort()) {
    const css = new URL(`${name}/${name}.css`, components);
    if (existsSync(css)) parts.push(readFileSync(css, "utf8"));
  }
}
parts.push(readFileSync(new URL("tokens/reduced-motion.css", src), "utf8"));
writeFileSync(new URL("../dist/styles.css", import.meta.url), parts.join("\n"));
