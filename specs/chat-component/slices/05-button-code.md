# 05: Button code

**Question:** Does the native `button` meet its contract?

**Seam:** `packages/keen/src/components/Button/`: `Button.tsx`, `Button.css`, a story for each state and variant, and `packages/keen/tests/components/Button.test.tsx`; exported from `packages/keen/src/react.ts`.

**Check:** `pnpm verify` (component-forwarding, token-reads, contract-roles, package-exports, storybook-build) and `pnpm test` pass, with tests for each variant's role and name, `aria-disabled` keeping focus and the tab order, and the focus ring on focus-visible. Under about 400 hand-written lines. Fails if any gate or test fails.

**Must stay green:** Every existing check; the design slice's exports.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Native `button`; no base library.
- No `className`, `style` or spread props; layout follows the Open-questions answer.

**Delegated to the worker:**
- Test cases beyond those named; story layout.

**Out of scope:**
- Its use inside Chat (10, 13).
