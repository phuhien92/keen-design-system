import type { Meta, StoryObj } from "@storybook/react-vite";
import { keenTokens } from "../../../packages/keen/src/tokens/tokens.ts";

const { color, motion, radius, space } = keenTokens;

// The generated semantic tokens, rendered in the toolbar's mode. The live tier reads these swatches' computed colors.
function TokenSample() {
  return (
    <div style={{ display: "grid", gap: space.semantic["inset-md"], fontFamily: keenTokens.font.semantic["family-body"] }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: space.semantic["gap-sm"] }}>
        {Object.entries(color.semantic).map(([role, value]) => (
          <div
            key={role}
            style={{
              border: `1px solid ${color.semantic.border}`,
              borderRadius: radius.semantic.control,
              padding: space.semantic["inset-sm"],
            }}
          >
            <div data-token={`color.semantic.${role}`} style={{ background: value, height: 40, borderRadius: radius.semantic.control }} />
            <code>{role}</code>
          </div>
        ))}
      </div>
      <div
        data-testid="motion-sample"
        style={{
          transition: `opacity ${motion.semantic["duration-fast"]} ${motion.semantic["easing-standard"]}`,
          background: color.semantic.action,
          color: color.semantic["text-on-action"],
          padding: space.semantic["inset-md"],
          borderRadius: radius.semantic.container,
        }}
      >
        Hover transition (motion.semantic.use-hover)
      </div>
      <div data-testid="scroll-sample" style={{ height: 48, overflow: "auto", scrollBehavior: "smooth" }}>
        <div style={{ height: 200 }}>Scrolls smoothly, or jumps under reduced motion</div>
      </div>
    </div>
  );
}

const meta: Meta<typeof TokenSample> = { title: "Foundations/Tokens", component: TokenSample };
export default meta;

export const Sample: StoryObj<typeof TokenSample> = {};
