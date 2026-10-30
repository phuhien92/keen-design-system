// Live-tier checks: Playwright against the built Storybook and the built Astro fixture.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import type { Browser, Page } from "playwright";

export const storybookDir = "apps/storybook/storybook-static";
export const fixtureDist = "apps/fixture-astro/dist";

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

// Serves a built static site on a free local port.
async function serve(dir: string): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(dir, path);
    if (existsSync(file) && !extname(file)) file = join(file, "index.html");
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

export type LiveResult = { skip: string } | { failures: string[] };

// Runs a check with a Chromium page against a served directory; skips when the build or the browser is missing.
export async function withPage(
  root: string,
  dir: string,
  build: string,
  check: (page: Page, url: string) => Promise<string[]>,
): Promise<LiveResult> {
  if (!existsSync(join(root, dir))) return { skip: `${dir} is missing; run ${build}` };
  let browser: Browser;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
  } catch (error) {
    return {
      skip: `Playwright Chromium is unavailable (pnpm exec playwright install chromium): ${(error as Error).message.split("\n")[0]}`,
    };
  }
  const site = await serve(join(root, dir));
  try {
    const page = await browser.newPage();
    return { failures: await check(page, site.url) };
  } finally {
    site.close();
    await browser.close();
  }
}

const story = (url: string, id: string, globals: string) => `${url}/iframe.html?id=${id}&viewMode=story&globals=${globals}`;
const hex = (rgb: string) =>
  `#${(rgb.match(/\d+/g) ?? [])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
const ms = (duration: string) => Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000);

// The token-sample story renders every semantic color role with its resolved value in light and dark.
export const checkTokenSample = (baseline: Map<string, Record<string, { value: string }>>) => async (page: Page, url: string) => {
  const failures: string[] = [];
  for (const mode of ["light", "dark"]) {
    await page.goto(story(url, "foundations-tokens--sample", `theme:${mode}`));
    await page.waitForSelector("[data-token]");
    const swatches = await page.$$eval("[data-token]", (els) =>
      els.map((e) => [e.getAttribute("data-token"), getComputedStyle(e).backgroundColor]),
    );
    if (swatches.length === 0) failures.push(`the token sample renders no swatches in ${mode}`);
    for (const [name, rgb] of swatches) {
      const expected = baseline.get(name ?? "")?.[mode]?.value;
      if (hex(rgb ?? "") !== expected) failures.push(`${name} renders ${hex(rgb ?? "")} in ${mode}; the token resolves to ${expected}`);
    }
  }
  return failures;
};

// Durations equal their tokens, and collapse to 0.01ms with reduced motion emulated by the OS or by the toolbar.
export const checkReducedMotion = (fastMs: number) => async (page: Page, url: string) => {
  const failures: string[] = [];
  const sample = async () =>
    page.$eval("[data-testid=motion-sample]", (e) => ({
      duration: getComputedStyle(e).transitionDuration,
      scroll: getComputedStyle(document.querySelector("[data-testid=scroll-sample]") as Element).scrollBehavior,
      running: document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            (a.constructor.name === "CSSAnimation" || a.effect?.getTiming().iterations === Number.POSITIVE_INFINITY),
        ).length,
    }));
  await page.goto(story(url, "foundations-tokens--sample", "theme:light"));
  await page.waitForSelector("[data-testid=motion-sample]");
  const full = await sample();
  if (ms(full.duration) !== fastMs)
    failures.push(`the hover transition lasts ${full.duration}; motion.semantic.duration-fast is ${fastMs}ms`);
  for (const [how, emulate, globals] of [
    ["prefers-reduced-motion", true, "theme:light"],
    ["the toolbar switch", false, "theme:light;motion:reduce"],
  ] as const) {
    await page.emulateMedia({ reducedMotion: emulate ? "reduce" : "no-preference" });
    await page.goto(story(url, "foundations-tokens--sample", globals));
    await page.waitForSelector("[data-testid=motion-sample]");
    const reduced = await sample();
    if (Math.abs(ms(reduced.duration) - 0.01) > 1e-6)
      failures.push(`with reduced motion from ${how}, the hover transition lasts ${reduced.duration}, not 0.01ms`);
    if (reduced.scroll !== "auto") failures.push(`with reduced motion from ${how}, scroll-behavior is ${reduced.scroll}, not auto`);
    if (reduced.running > 0)
      failures.push(`with reduced motion from ${how}, ${reduced.running} infinite or entrance animations are running`);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return failures;
};

// Keen's reduced-motion rules stay inside Keen: the fixture host's own transition is unchanged.
export const checkHostMotion = async (page: Page, url: string) => {
  const duration = async (reducedMotion: "reduce" | "no-preference") => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(url);
    return page.$eval("[data-testid=host-button]", (e) => getComputedStyle(e).transitionDuration);
  };
  const full = await duration("no-preference");
  const reduced = await duration("reduce");
  return full === reduced && ms(full) > 0
    ? []
    : [`the host button's transition is ${full} normally and ${reduced} with reduced motion; Keen must not change it`];
};

// Storybook builds and indexes the token-sample and motion stories.
export function checkStorybookBuild(root: string): string[] {
  execFileSync("pnpm", ["--filter", "@keen/storybook", "build"], { cwd: root, stdio: "pipe" });
  const index = JSON.parse(readFileSync(join(root, storybookDir, "index.json"), "utf8"));
  return ["foundations-tokens--sample", "foundations-motion--replay"]
    .filter((id) => !index.entries?.[id])
    .map((id) => `Storybook does not index story ${id}`);
}
