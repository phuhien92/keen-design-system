# 09: Notice code

**Question:** Does `role` follow the variant, with an actions slot for Retry?

**Seam:** `packages/keen/src/components/Notice/`: `Notice.tsx`, `Notice.css`, a story for each state and variant, and `packages/keen/tests/components/Notice.test.tsx`; exported from `packages/keen/src/react.ts`.

**Check:** `pnpm verify` (component-forwarding, token-reads, contract-roles, package-exports, storybook-build) and `pnpm test` pass, with tests for `status` vs `alert` per variant, the icon through `Icon`, and a Button in the actions slot. Under about 400 hand-written lines. Fails if any gate or test fails.

**Must stay green:** Every existing check; the design slice's exports.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**

**Delegated to the worker:**
- Test cases beyond those named.

**Out of scope:**
- Its use inside Chat (10, 13).
