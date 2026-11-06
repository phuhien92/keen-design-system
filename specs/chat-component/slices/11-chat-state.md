# 11: Chat state machine

**Question:** Does the logic follow every `transitions[]` entry in `chat.json`?

**Seam:** `packages/keen/src/components/Chat/state.ts`: a pure reducer and the adapter types from `chat.json`'s `api.types` (ChatMessage, ChatAdapter, ChatRateLimit), plus the behaviour rules: Stop aborts and ignores later chunks, an abort after Stop is not an error, Retry after error mid-stream removes the partial message.

**Check:** A table-driven vitest reads `chat.json`'s `transitions` and runs each one through the reducer; every behaviour rule has a test. Fails if any transition or rule disagrees.

**Must stay green:** `pnpm test`, `pnpm typecheck`.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Pure TypeScript: no React, no DOM.

**Delegated to the worker:**
- Action names and the reducer's internal shape.

**Out of scope:**
- The view (13).
