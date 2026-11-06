# 10: Chat contract migration

**Question:** Does Chat validate as a composite?

**Seam:** `docs/components/chat.json`: send, stop, suggestion, input and the three notices become `uses` parts; their bindings (about 65 of 113) and any orphaned `chat.*` tokens go; `contractVersion` goes up; status stays `proposed`. The Chat frames in `design/keen.pen` draw those parts as primitive instances, in the same change. The user re-renders all Chat exports.

**Check:** `pnpm contract:check` and `pnpm verify` (tokens-contract, tokens-baseline, design-anatomy) pass; the old exports are replaced by re-rendered ones, never renamed. Then the user reviews the re-exports. Under about 400 hand-written lines by keen's measure (deletions count); if over, split the contract and token removal from the frame swap only if each half still passes CI.

**Must stay green:** Every check; the primitives' contracts.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Contract, tokens and frames change together: dropping bindings while frames still draw Chat-tagged fills fails design-anatomy.
- Batch the 18 Chat re-exports into one request to the user.

**Delegated to the worker:**
- Which chat-specific parts keep which `chat.*` tokens.

**Out of scope:**
- Chat's code (11–13).
