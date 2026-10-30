import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import semantic from "../../../tokens/semantic.json";

// Every named use from tokens/semantic.json, replayed side by side for review.
const cssVar = (reference: string) => `var(--keen-${reference.slice(1, -1).replaceAll(".", "-")})`;
const uses = Object.entries(semantic.motion.semantic)
  .filter(([name]) => name.startsWith("use-"))
  .map(([name, token]) => {
    const value = (token as { $value: { duration: string; timingFunction: string } }).$value;
    return { name, duration: cssVar(value.duration), easing: cssVar(value.timingFunction) };
  });

function MotionReplay() {
  const [played, setPlayed] = useState(false);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <button type="button" onClick={() => setPlayed((p) => !p)} style={{ justifySelf: "start" }}>
        Replay
      </button>
      {uses.map((use) => (
        <div key={use.name} style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "center" }}>
          <code>motion.semantic.{use.name}</code>
          <div
            data-use={use.name}
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: "var(--keen-color-semantic-action)",
              transform: played ? "translateX(240px)" : "none",
              opacity: played ? 1 : 0.4,
              transition: `transform ${use.duration} ${use.easing}, opacity ${use.duration} ${use.easing}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

const meta: Meta<typeof MotionReplay> = { title: "Foundations/Motion", component: MotionReplay };
export default meta;

export const Replay: StoryObj<typeof MotionReplay> = {};
