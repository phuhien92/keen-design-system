// The internal Icon's labelling rule, from its rendered markup.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon } from "../../src/icons/Icon.tsx";

describe("Icon", () => {
  it("is hidden from assistive technology by default", () => {
    const svg = renderToStaticMarkup(<Icon name="arrow-up" />);
    expect(svg).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(svg).not.toMatch(/role=|aria-label=|aria-labelledby=/);
  });

  it("is an image named by its label when it stands alone", () => {
    const svg = renderToStaticMarkup(<Icon name="wifi-off" label="Offline" />);
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/aria-label="Offline"/);
    expect(svg).not.toMatch(/aria-hidden|aria-labelledby/);
  });

  it("sizes through --keen-icon-size classes and inherits currentColor", () => {
    const svg = renderToStaticMarkup(<Icon name="square" size="sm" />);
    expect(svg).toMatch(/class="[^"]*keen-icon keen-icon--sm"/);
    expect(svg).toMatch(/stroke="currentColor"/);
  });
});
