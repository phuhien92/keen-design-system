// Checks the foreground/background pairs each Component Contract requires, in every mode.
import { modes } from "./model.ts";
import type { Resolved } from "./resolve.ts";

export interface ContrastPair {
  foreground: string;
  background: string;
  minimum: number;
}

const luminance = (hex: string) => {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function checkContrast(pairs: ContrastPair[], resolved: Map<string, Resolved>, source: string): string[] {
  const failures: string[] = [];
  for (const pair of pairs) {
    for (const mode of modes) {
      const hex = (name: string) => (resolved.get(name)?.modes[mode].value as { hex?: string } | undefined)?.hex;
      const fg = hex(pair.foreground);
      const bg = hex(pair.background);
      if (!fg || !bg) {
        failures.push(`${source}: ${pair.foreground} on ${pair.background} names a color token that does not exist`);
        break;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio + 1e-9 < pair.minimum) {
        failures.push(`${source}: ${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1 in ${mode}, below ${pair.minimum}:1`);
      }
    }
  }
  return failures;
}
