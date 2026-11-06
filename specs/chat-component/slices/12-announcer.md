# 12: Streaming announcer

**Question:** Is only new text announced?

**Seam:** `packages/keen/src/components/Chat/announce.ts`: a pure function from the previous and current assistant text (and status) to the text the polite live region should announce.

**Check:** Unit tests: each streamed delta is announced once, the full message is never re-read, and stopped and error statuses announce their labels. Fails otherwise.

**Must stay green:** `pnpm test`.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Pure function; the view owns the live region element.

**Delegated to the worker:**
- Whether deltas are batched, within the contract's screen-reader rules.

**Out of scope:**
- The view (13).
