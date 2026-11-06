# 02: Composition in the contract schema

**Question:** Can a contract say "this part uses Button `primary`", and do variants become typed?

**Seam:** `docs/components/component-contract.schema.json` and `docs/components/contract.mjs`: an optional anatomy `uses: { component, variant }`; typed `overrides.variants`; an optional `variant` on a binding. The Component Guide renders "uses Button `primary`".

**Check:** New fixture tests for `contract:check` pass: it accepts a `uses` part, and rejects a binding on a `uses` part, an unknown component, an unknown variant, and a binding naming an undeclared variant. `chat.json` still passes unchanged. Fails if any fixture is accepted or rejected wrongly.

**Must stay green:** `pnpm verify`, `pnpm contract:check`, `pnpm test`.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- `uses` is optional; existing contracts need no change.
- A `docs/decisions.md` entry: no base library for these primitives; Base UI is the leading candidate for the first popover, dialog or menu.

**Delegated to the worker:**
- Field names inside `uses`, and how the guide words it.

**Out of scope:**
- The design gate (03). The chat migration (10).
