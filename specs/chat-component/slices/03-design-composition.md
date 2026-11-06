# 03: Composition in the design gate

**Question:** Does design-anatomy accept a nested primitive instance and reject a wrong variant?

**Seam:** `tools/token-generator/src/design.ts`: a `uses` part counts as drawn when a layer tagged with that part holds the used component's root tag; tokens inside it are checked against the used component's contract and variant; the inherited-property lookup (`design.ts:193`) stays inside one component's tags.

**Check:** New unit tests with a fixture Pen tree pass: a Chat part drawn by a Button `primary` instance passes; the same part filled with a `secondary` token fails naming the variant; a Chat-tagged token check never matches a Button part of the same name. Fails if any case flips.

**Must stay green:** Every existing gate test; `pnpm verify` on the real design.

**Size:** run keen's numstat command from `AGENTS.md` before the PR; over about 400 hand-written lines, say so in the handback and suggest Reslice.

**Decided:**
- Only design-anatomy changes; token-reads and contract-roles already check per component folder (`boundary.ts:78`).

**Delegated to the worker:**
- The fixture tree's layout; error wording, which must name the rule like the existing messages.

**Out of scope:**
- Real Button frames (04).
