# 13: Chat view

**Question:** Does each state render with the primitives, with focus return and keyboard Stop?

**Seam:** `packages/keen/src/components/Chat/Chat.tsx` and `Chat.css`: log, bubbles, composer frame and live region, composing Button, TextArea and Notice, driven by 11 and 12; exported from `react.ts`.

**Check:** `pnpm verify` (token-reads: Chat.css reads only `chat.*`; component-forwarding; contract-roles) and `pnpm test` pass, with tests for focus returning to the input after a send, Escape stopping generation, and the focus moves in `chat.json`'s focus rules. Under about 400 hand-written lines; if over, split rendering of the log from the composer.

**Must stay green:** Every check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- No focus trap, no autofocus on mount (contract).

**Delegated to the worker:**
- Component structure inside Chat.

**Out of scope:**
- Stories and the example (14).
