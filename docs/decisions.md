# Decisions

A running log of Keen's design and engineering decisions, written as each one lands. Each entry records what was decided, why, what was rejected, and what it would cost to change later. The evidence behind the early entries is in [research.md](research.md).

## Open

- **Component technology:** React, Web Components, or headless hooks. Waits on inspecting portfolio-blog's framework, styling setup, and deploy constraints (research §6, step 2). Blocks Milestone 1.
- **Token format and build tool:** the canonical source format and what generates the outputs. Also waits on the portfolio-blog inspection.
- **Distribution:** npm package, workspace package, or copy-in source. Not before the API and consumer needs are understood (research §8).
- **Which accessible primitives:** the library Keen builds on. Follows the component technology decision.
- **Brain CLI as a consumer:** what Keen offers a CLI (shared terminal color tokens?), or whether it leaves the consumer list.
- **Component metadata format:** the machine-readable file behind "AI-ready". Follows the stack decision.

## Decided

### 2026-10-28: Own the system layer, build on accessible primitives

Keen owns its component APIs, theme contract, documentation, packaging, and MCP context. Where a component has complex interaction (focus management, popovers, dialogs), it builds on an established accessible primitives library instead of hand-rolling it.

Rejected: building every primitive from scratch, which is slower and is where hand-rolled accessibility usually fails. Also rejected: adopting a full component library and adding docs on top, which shows little evidence of designing a system and carries host assumptions that limit reuse. The risk this choice carries is Keen becoming a thin rebrand of the primitives, so Keen's value has to sit in the APIs, tokens, and documentation.

### 2026-10-28: Keen owns the chat UI; the host owns the AI

The chat component owns presentation and reusable interaction behavior. The host application owns the model, provider, credentials, and conversation persistence, and connects them through props or adapters.

The portable layer does not import framework routing, product stores or data models, provider clients, browser-extension APIs, or app-specific navigation and copy. Putting any of these in the shared package would tie it to its first consumer and could leak secrets into a library.

### 2026-10-28: Three token tiers from one canonical source

Tokens are split into primitive (palette, type and spacing scales, radii), semantic (surface, text, border, action, focus), and component tiers. One canonical source generates every output format; no format is maintained by hand. Components consume semantic roles, never brand values, and each product maps the roles to its brand.

Milestone 1 starts with only the semantic tokens chat needs. Token categories are added when a consumer needs them, not ahead of it.

### 2026-10-28: Milestone 1 has testable exit criteria

The README's "Done when" list replaces goals like "accessible keyboard and focus behavior" with checks that pass or fail. Chat UIs most often get the stopped and mid-stream error states wrong, so both are named states that keep the partial response.
