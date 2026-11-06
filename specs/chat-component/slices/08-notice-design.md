# 08: Notice design

**Question:** Is Notice's contract, tokens and drawn design right for the notices?

**Seam:** `pnpm new:component Notice`; `docs/components/notice.json` with every `TODO:` written (variants `warning` and `error`; an icon, title, detail and an `actions` slot); `notice.*` tokens in `tokens/component.json`, each with a `$description`; `pnpm tokens:build`; frames per state and variant, light and dark, in `design/keen.pen` (variables only, every part tagged); the user's exports in `design/exports/`; `node docs/components/contract.mjs render`.

**Check:** `pnpm contract:check` and `pnpm verify` pass, and the hand-written lines are under about 400 by keen's measure. Then the user reviews the light and dark exports and approves or asks for changes; recorded in `decisions.md`. In an unattended run: wait a short window, continue, and record why.

**Must stay green:** Every existing check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- `variant` decides `role`: `warning` is `status`, `error` is `alert`.

**Delegated to the worker:**
- Token values; frame layout; whether detail is optional.

**Out of scope:**
- Notice's code (09).
