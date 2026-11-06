# 07: TextArea code

**Question:** Are Enter, Shift+Enter and IME composition handled, and can a parent return focus to it?

**Seam:** `packages/keen/src/components/TextArea/`: `TextArea.tsx`, `TextArea.css`, a story for each state and variant, and `packages/keen/tests/components/TextArea.test.tsx`; exported from `packages/keen/src/react.ts`.

**Check:** `pnpm verify` (component-forwarding, token-reads, contract-roles, package-exports, storybook-build) and `pnpm test` pass, with tests for Enter submitting, Shift+Enter inserting a newline, Enter during composition not submitting, and a ref that receives focus. Under about 400 hand-written lines. Fails if any gate or test fails.

**Must stay green:** Every existing check; the design slice's exports.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- jsdom simulates composition events, not real input methods; say so in the test file.

**Delegated to the worker:**
- How submit is signalled (callback name); auto-grow, if any, within the contract.

**Out of scope:**
- Its use inside Chat (10, 13).
