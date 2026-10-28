# Decisions

A running log of Keen's design and engineering decisions, written as each one lands. Each entry records what was decided, why, what was rejected, and what it would cost to change later.

## Open

- **Component technology:** React, Web Components, or headless hooks. Blocks Milestone 1.
- **Token format:** CSS custom properties, DTCG JSON, or Tailwind theme variables. Blocks Milestone 1.
- **Distribution:** npm package, workspace package, or copy-in source.
- **Brain CLI as a consumer:** what Keen offers a CLI (shared terminal color tokens?), or whether it leaves the consumer list.
- **Component metadata format:** the machine-readable file behind "AI-ready". Follows the stack decision.

## Decided

### 2026-10-28: Milestone 1 has testable exit criteria

The README's "Done when" list replaces goals like "accessible keyboard and focus behavior" with checks that pass or fail. Chat UIs most often get the stopped and mid-stream error states wrong, so both are named states that keep the partial response.
