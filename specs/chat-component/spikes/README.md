# Spike: toolchain and an agent-drawn frame (slice 01)

## Toolchain baseline (untouched tree at `847e726`, plus this spec)

- `pnpm install --frozen-lockfile`: 187 packages, no errors (pnpm 12.3.4, Node 22.23.4).
- `pnpm verify`: 15 passed, 0 failed, 2 skipped. The skips are `pen-live` and `icons-live`, which need a signed-in `pen` CLI.
- `pnpm contract:check`: `chat.json` passes.
- `pnpm test`: 122 passed, 1 skipped.
- `pnpm typecheck`: passes.
- `pnpm lint`: passes. Biome also formats markdown, so spec files must pass `biome check` too; the first draft of this spec didn't.

## Agent-drawn frames

`keen-spike.pen` is `design/keen.pen` plus two frames an agent wrote as JSON: **Spike · agent-drawn · light** (`spkL1`, at x 4608, y 200) and **Spike · agent-drawn · dark** (`spkD1`, at x 4608, y 1260). Each holds canvas-colored annotations, a frame tagged as Chat's `send` part and filled with `$color.semantic.action`, an instance of `Chat / Composer` with the focus-ring override, and an instance of `Chat / Notice / Offline`. The rest of the file is byte-identical to `design/keen.pen`.

- With `keen-spike.pen` swapped in for `design/keen.pen` in a throwaway copy of the repo, `pnpm verify` passes: design-variables and design-anatomy both accept the agent-drawn layers.
- **Negative control:** changing the agent-drawn Send fill to `$color.semantic.warning` makes design-anatomy fail with `Spike · agent-drawn · light > Send (agent-drawn): draws background with $color.semantic.warning, but docs/components/chat.json binds send background → color.semantic.action`. So the gate reads agent-written layers; a pass is real.

## Waiting on the user

Open `keen-spike.pen` in Pen and export the two "Spike · agent-drawn" frames as PNG into this folder (`spike-light.png`, `spike-dark.png`). The decision: does Pen open the file without complaint, and do the renders match what the frames describe (a blue round Send, a focused Composer, the Offline notice, with dark colors in the dark frame)? If not, the fallback in the spec's Open questions applies.
