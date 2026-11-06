# 14: Every state reachable

**Question:** Does Milestone 1's "Done when" hold?

**Seam:** Stories for all nine states and an example with a fake adapter that reaches each one; axe checks.

**Check:** `storybook-build` passes; `pnpm test` with axe reports no WCAG 2.1 AA violations in any state; each state is reachable in the example. Then the user checks the example against the README's "Done when" list. Fails if any state is unreachable or axe reports a violation.

**Must stay green:** Every check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- The fake adapter lives with the stories, never in the package.

**Delegated to the worker:**
- Story names and grouping.

**Out of scope:**
- portfolio-blog (its own spec).
