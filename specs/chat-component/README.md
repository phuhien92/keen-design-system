# Chat component, built on Keen primitives

**Branch:** `claude/chat-component` (the spec; each PR below gets its own stacked branch)

**Base:** `origin/main`

**Size:** keen's own rule governs: about 400 hand-written lines per PR, added plus deleted, measured with the `git diff --numstat` command in `AGENTS.md` ("Pull requests"). For a view of new versus moved lines, also run `python3 <agent-skills>/skills/slice-spec/scripts/diff_size.py . origin/main..HEAD`.

## Intent

> approve to build the chat task

> primitive components should get built first. Then they get added to the chat component.

> agent also draw the pen.

The rest was settled in the interview, each answer accepted by the user:

- **Three primitives, from what Chat reuses:** Button (send, stop, retry, suggestions), TextArea (the input: Enter, Shift+Enter, IME rules, focus ring), Notice (offline banner, rate-limit notice, error notice: `role=status` or `alert`, icon, title, detail). The message list, bubbles and the live region stay inside Chat.
- **No base library** (Base UI, React Aria, Radix) for these three: they are native `button`, `textarea` and status elements. `docs/decisions.md` records Base UI as the leading candidate for the first component with a popover, dialog or menu.
- **Primitives own their styling.** `button.*`, `textarea.*`, `notice.*` tokens, with variants (Button `primary`, `secondary`, `ghost`; Notice `warning`, `error`). `chat.json` is revised so those parts *use* a primitive variant; its duplicate bindings go, `contractVersion` goes up, and it stays `proposed`. Chat keeps `chat.*` tokens only for its own parts (log, bubbles, composer frame). No `chat.send-*` aliases unless portfolio-blog needs them later.
- **Button goes end to end first**, before TextArea and Notice start. One user review gate per primitive: the user looks at its light and dark exports before its code PR. In an unattended run the worker waits a short window, then continues and records why.
- **Agents draw the Pen frames** in `design/keen.pen`'s JSON; **the user renders the PNG exports** with their signed-in `pen` CLI. No Pen key enters this environment.

How the user will know it worked: Milestone 1's in-repo "Done when" (`README.md`): every conversation state (empty, loading, streaming, completed, error, stopped, error mid-stream, rate limited, offline) renders and is reachable in an example; the chat meets WCAG 2.1 AA; streamed text is announced through a polite `aria-live` region without re-reading the whole message; focus returns to the input after a send; Stop works from the keyboard. And `pnpm verify`, `pnpm contract:check` and `pnpm test` pass.

## Non-goals

- portfolio-blog integration (its own spec, in that repo, after Chat ships).
- A base library; an MCP interface; components beyond Button, TextArea, Notice and Chat.
- Moving any contract to `approved`: that is the user's call after its code ships.
- Refactoring the gate system beyond what composition needs.

## Constraints

- Every rule in `AGENTS.md`: generated files are never hand-edited, Pen colors are variables, every part layer carries `keen-part` metadata, components take no `className` or `style` and spread no props, a component reads only the tokens its own contract binds, motion through named uses, icons through `Icon`, every component starts from `pnpm new:component`.
- Stacked PRs: each targets the previous one's branch and passes CI on its own.
- Backward compatibility: none shipped. `chat.json` is `proposed`, and no host consumes Keen yet.

## Slice graph

| # | Slice | Question it answers | Check | Depends on | PR |
|---|---|---|---|---|---|
| 01 | Spike: toolchain and an agent-drawn frame | Does the toolchain run here, and does an agent-written `keen.pen` render unchanged in the user's `pen` CLI? | `pnpm verify` baseline + user's export of a scratch frame | none | none |
| 02 | Composition in the contract schema | Can a contract say "this part uses Button `primary`", and do variants become typed? | `contract:check` fixture tests | 01 | 1 |
| 03 | Composition in the design gate | Does design-anatomy accept a nested primitive instance and reject a wrong variant? | gate unit tests with a fixture Pen tree | 02 | 2 |
| 04 | Button design | Is Button's contract, tokens and drawn design right? | `contract:check`, `pnpm verify` + **user review of exports** | 02 | 3 |
| 05 | Button code | Does the native button meet its contract? | `pnpm verify`, `pnpm test` | 04 | 4 |
| 06 | TextArea design | Same, for the input | as 04 | 05 | 5 |
| 07 | TextArea code | Are Enter, Shift+Enter and IME handled, and is focus returnable? | as 05 | 06 | 6 |
| 08 | Notice design | Same, for the notices | as 04 | 05 | 7 |
| 09 | Notice code | Does `role` follow the variant, with an actions slot for Retry? | as 05 | 08 | 8 |
| 10 | Chat contract migration | Does Chat validate as a composite? | `contract:check`, `pnpm verify` + **user re-exports** | 03, 07, 09 | 9 |
| 11 | Chat state machine | Does the logic follow every `transitions[]` entry in `chat.json`? | table-driven vitest from the contract | 02 | 10 |
| 12 | Streaming announcer | Is only new text announced? | unit test | 11 | 11 |
| 13 | Chat view | Does each state render with the primitives, focus return and keyboard Stop? | `pnpm verify`, `pnpm test` | 10, 11, 12 | 12 |
| 14 | Every state reachable | Does Milestone 1's "Done when" hold? | `storybook-build`, `pnpm test` with axe | 13 | 13 |

Build order comes from **Depends on**. 06/07 and 08/09 can run in parallel after 05; 11 and 12 can run any time after 02. 01 is a gate: if its export renders wrong, stop and reslice (see Open questions).

## Open questions

- **How Chat lays out a primitive without `className`.** **Recommended:** Chat wraps each primitive in its own element and styles the wrapper with `chat.*` tokens; primitives get no layout props. The user decides before 04, because it shapes Button's API.
- **Notice's API.** **Recommended:** `variant` (`warning` or `error`) sets `role` (`status` or `alert`); an `actions` slot holds Retry; title and detail are props. Decided by the worker in 08 unless the user says otherwise.
- **What if 01's export renders wrong.** **Recommended:** agents keep the tags and variables but the user draws frames; every design slice gains a human step. The user decides at the 01 gate.
- **Variant names are frozen before drawing.** **Recommended:** Button `primary`, `secondary`, `ghost`; Notice `warning`, `error`. Renaming after frames exist touches the Pen file and the contract together.

## Decided in planning

- **Composition before the primitives, not with Chat** (fail-fast and seams drafts): Button's variants need typed variants in the schema, and the gate change is the plan's biggest structural risk. Turned down: the lean draft's "ship the seam with its first consumer", which would have left it until after all three primitives.
- **Two PRs per primitive, design then code** (lean draft): the design PR carries the contract, tokens, frames and the user's exports, about 150–250 hand-written lines (`design/keen.pen` does not count). Turned down: `AGENTS.md`'s three-PR example, because here the frames are tiny and one review of contract plus design is the natural gate.
- **The state machine and announcer are pure TypeScript slices** (seams draft), testable from the contract before the view exists. The view slice composes them.
- **Inherited-property lookup stays inside one component** (seams draft found `design.ts:193` matches `b.part` across components' tags): fixed in 03.
- **Chat's CSS never reads `button.*`** (`boundary.ts:78` already checks per component folder): Button styles itself; Chat lays it out.
- **The chat-only schema enums (`states[].composer`, `partialResponse`) stay;** primitive contracts leave them out.
- **Spike first** (fail-fast draft): no gate has run in this environment, and agent-written Pen files are unproven.

## Next agent prompt

Status: spec written, nothing built. Start with slice 01 (`slices/01-spike.md`). It needs `pnpm install`, and a person to render one export with the signed-in `pen` CLI. Ask the user the open layout question before slice 04.

Before reporting a slice done, follow the `decision-checker` skill in Check mode on this branch and save `decisions.md`. Update this prompt before you end.
