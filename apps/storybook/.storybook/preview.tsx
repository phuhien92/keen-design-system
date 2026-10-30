import type { Preview } from "@storybook/react-vite";
import "../../../packages/keen/src/tokens/tokens.css";
import "../../../packages/keen/src/icons/Icon.css";
import "../../../packages/keen/src/tokens/reduced-motion.css";
import reducedMotion from "../../../packages/keen/src/tokens/reduced-motion.css?raw";

// The toolbar's reduced-motion switch applies Keen's generated reduced-motion rules without the media query, under
// [data-keen-motion="reduce"], so every story can be reviewed with reduced motion whatever the OS setting.
const emulated = document.createElement("style");
emulated.textContent = reducedMotion
  .replace("@media (prefers-reduced-motion: reduce)", "@media all")
  .replaceAll("[data-keen-root]", '[data-keen-motion="reduce"] [data-keen-root]');
document.head.append(emulated);

const preview: Preview = {
  globalTypes: {
    theme: { description: "Keen mode", toolbar: { title: "Mode", icon: "contrast", items: ["light", "dark"], dynamicTitle: true } },
    motion: {
      description: "Reduced motion",
      toolbar: { title: "Motion", icon: "lightning", items: ["full", "reduce"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light", motion: "full" },
  decorators: [
    (Story, context) => (
      <div data-keen-motion={context.globals.motion}>
        <div
          data-keen-root
          data-keen-mode={context.globals.theme}
          style={{ background: "var(--keen-color-semantic-surface)", color: "var(--keen-color-semantic-text-primary)", padding: 24 }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
};

export default preview;
