import { keenTokens } from "@keen/design-system/tokens";

const { chat, color, font, radius, space } = keenTokens;

// Host-owned markup styled with Keen's typed token map, component tokens included, and Tailwind utilities mapped to Keen roles.
export function ThemedSample({ mode }: { mode: "light" | "dark" }) {
  return (
    <section
      data-testid="themed-sample"
      data-mode={mode}
      style={{
        background: color.semantic.surface,
        color: color.semantic["text-primary"],
        border: `1px solid ${color.semantic.border}`,
        borderRadius: radius.semantic.container,
        padding: space.semantic["inset-md"],
        fontFamily: font.semantic["family-body"],
      }}
    >
      <p style={{ color: color.semantic["text-subtle"] }}>Themed {mode} sample</p>
      <button
        type="button"
        data-testid="host-button"
        className="bg-keen-action text-keen-on-action rounded-keen-control px-4 py-2 transition-colors duration-300"
      >
        Host action
      </button>
      <p
        data-testid="user-bubble"
        style={{ background: chat["message-user-background"], color: chat["message-user-text"], borderRadius: chat["message-radius"] }}
      >
        A component token that aliases the host's action color
      </p>
    </section>
  );
}
