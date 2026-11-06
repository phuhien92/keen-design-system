# 04: Button design

**Question:** Is Button's contract, tokens and drawn design right?

**Seam:** `pnpm new:component Button`; `docs/components/button.json` with every `TODO:` written (variants `primary`, `secondary`, `ghost`; states rest, hover, focus-visible, pressed, `aria-disabled`); `button.*` tokens in `tokens/component.json`, each with a `$description`; `pnpm tokens:build`; frames per state and variant, light and dark, in `design/keen.pen` (variables only, every part tagged); the user's exports in `design/exports/`; `node docs/components/contract.mjs render`.

**Check:** `pnpm contract:check` and `pnpm verify` pass, and the hand-written lines are under about 400 by keen's measure. Then the user reviews the light and dark exports and approves or asks for changes; recorded in `decisions.md`. In an unattended run: wait a short window, continue, and record why.

**Must stay green:** Every existing check.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Variant names are frozen before drawing (see Open questions).
- The contract stays `proposed`.
- This is the first agent-drawn component: if a design gate can't be made to pass, stop and reslice instead of loosening the gate.

**Delegated to the worker:**
- Token values within the semantic roles; frame layout on the canvas.

**Out of scope:**
- Button's code (05).
