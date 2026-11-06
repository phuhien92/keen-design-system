# 06: TextArea design

**Question:** Is TextArea's contract, tokens and drawn design right for the input?

**Seam:** `pnpm new:component TextArea`; `docs/components/textarea.json` with every `TODO:` written (Enter, Shift+Enter, IME composition and focus-ring rules taken from `chat.json`'s keyboard and focus sections); `textarea.*` tokens in `tokens/component.json`, each with a `$description`; `pnpm tokens:build`; frames per state and variant, light and dark, in `design/keen.pen` (variables only, every part tagged); the user's exports in `design/exports/`; `node docs/components/contract.mjs render`.

**Check:** `pnpm contract:check` and `pnpm verify` pass, and the hand-written lines are under about 400 by keen's measure. Then the user reviews the light and dark exports and approves or asks for changes; recorded in `decisions.md`. In an unattended run: wait a short window, continue, and record why.

**Must stay green:** Every existing check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- The keyboard rules move from `chat.json` into `textarea.json` unchanged in meaning; 10 removes them from Chat.

**Delegated to the worker:**
- Token values; frame layout.

**Out of scope:**
- TextArea's code (07).
