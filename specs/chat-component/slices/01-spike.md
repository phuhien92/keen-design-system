# 01: Spike: toolchain and an agent-drawn frame

**Question:** Does the toolchain run here, and does an agent-written `keen.pen` render unchanged in the user's `pen` CLI?

**Seam:** None in product code. `pnpm install`; then a scratch copy of `design/keen.pen` under `specs/chat-component/spikes/` with one added frame: a tagged rectangle filled with a variable, plus one `ref` instance of an existing Chat layer with a `descendants` override.

**Check:** `pnpm install` succeeds and `pnpm verify`, `pnpm contract:check` and `pnpm test` pass on the untouched tree (record any that fail and why). Then the user exports the scratch frame light and dark; the user's decision on the two PNGs is whether they match what the frame says. Fails if Pen rejects the file or the render differs.

**Must stay green:** The real `design/keen.pen`; every existing check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- The scratch file stays under `spikes/`; nothing in `design/` changes.
- Record the baseline result of every gate, so later slices know which failures are theirs.

**Delegated to the worker:**
- How the scratch frame is laid out.

**Out of scope:**
- Real components (04 onward).
