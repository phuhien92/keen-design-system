# Decisions

A running log of Keen's design and engineering decisions, written as each one lands. Each entry records what was decided, why, what was rejected, and what it would cost to change later. The evidence behind the early entries is in [research.md](research.md).

## Open

- **Which accessible primitives:** the React library Keen builds on. Now unblocked by the component technology decision.
- **Brain CLI as a consumer:** what Keen offers a CLI (shared terminal color tokens?), or whether it leaves the consumer list.
- **Component metadata format:** the machine-readable file behind "AI-ready". Follows the stack decision, which has now landed.

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

### 2026-10-28: React is the component technology

Keen's components are written in React. The first consumer, portfolio-blog, is Astro 5 with React 19 islands and Tailwind v4, so React components drop into it without a wrapper layer.

Rejected: Web Components, which would add a custom-element boundary between Keen and the React islands that host it, and headless hooks only, which would push markup and styling onto every host. Changing later would mean rewriting every component and its stories, so the cost grows with the catalog.

### 2026-10-28: Hosts install a pinned build, never component source

Keen ships as one package that hosts install as a pinned build: a pinned GitHub build or a packed tarball until public npm publication is needed. Hosts never copy or edit component source. A fix lands once in Keen and reaches every consumer through a version bump.

Rejected: a shadcn-style copy-in source registry. Per-app component edits would fragment the design system and stop fixes from reaching consumers. Moving to public npm later is cheap, since only the install source changes. Moving to copy-in later would be expensive to undo, because every edited copy would have to be reconciled.

### 2026-10-28: Hosts customize through themes only

Hosts customize Keen through semantic tokens, component-tier tokens (such as `chat.*`), and the variants and slots each Component Contract names. There is no `className` or `style` passthrough onto component internals and no unstyled mode. A need that theming cannot meet becomes a reviewed Keen change: a new token, variant, or prop.

Rejected: passthrough styling and an unstyled mode. Both let a host depend on internal markup, so Keen could no longer change its internals without breaking consumers, and the Milestone 1 check (no changes to Keen's component code) would stop meaning anything. Loosening this later is easy; tightening it after hosts depend on passthrough would break them.

### 2026-10-28: DTCG JSON is the canonical token source

Tokens are hand-edited in DTCG JSON only: `tokens/primitive.json`, `tokens/semantic.json`, and `tokens/component.json`. CSS custom properties and typed TypeScript exports are generated from them, and no output format is edited by hand. DTCG carries types, units, references, and descriptions that token tools, Pen, and future MCP retrieval can read, and its diffs can be validated in CI.

Rejected: CSS as the source, which loses type metadata and reliable references; TypeScript as the source, which ties the design source to one language; and Tailwind theme variables as the source, which ties it to one host's styling setup. Changing the source format later means migrating the token files and the generator, but no component code, since components read only the generated outputs.

### 2026-10-28: The tier is part of every token name

Every token name carries its tier as a segment. Primitives: `color.primitive.blue-600`, `space.primitive.md`. Semantic: `color.semantic.action`, `color.semantic.text-subtle`. Component tokens lead with the component: `chat.composer-height`. Generated CSS keeps the tier (`--keen-color-semantic-action: var(--keen-color-primitive-blue-600)`), so component code that reads a primitive-tier variable fails verification.

Putting the tier in the name makes the rule "components never read primitives" checkable with a pattern match instead of a review habit. Rejected: flat names without a tier, which would need a separate lookup to enforce. Renaming later touches every token, every generated variable, and every host theme that overrides one, so this is costly to change once hosts exist.

### 2026-10-28: Repository layout is a pnpm workspace

The repository is a pnpm workspace:

- `tokens/`: the canonical DTCG files.
- `packages/keen`: the one product package, with each component in a self-contained `src/components/<Name>/` folder.
- `tools/token-generator`: the private generator for CSS and TypeScript outputs.
- `apps/docs`: the documentation site.
- `apps/storybook`: the implementation review surface.
- `apps/fixture-astro`: an Astro + React + Tailwind v4 consumer that installs the packed package in CI, so packaging is tested the way portfolio-blog will use it.
- `.keen/`: token baselines and verification gates.

Rejected: splitting components or tokens into several published packages before a consumer needs it, which multiplies versioning for no gain. Splitting `packages/keen` later is possible because each component folder is self-contained.

### 2026-10-28: Storybook reviews implementation, Pen reviews design

Storybook is the implementation review surface: every named component state gets a story, checked with the accessibility addon in light and dark. Pen (`.pen`) is the visual design and review surface, and is never a token source. A token change made while designing in Pen comes back as a reviewed DTCG diff.

Rejected: treating Pen variables as a second token source, which would let design and code drift. Swapping either review tool later costs the stories or design files, not the components or tokens.

### 2026-10-28: The Milestone 1 consumer check stays as written

The README's last "Done when" item stays unchanged: "portfolio-blog renders the chat with its own tokens and no changes to Keen's component code." The distribution and customization decisions above are what make this check meaningful: the host installs a pinned build and themes it, and cannot pass the check by editing Keen.

### 2026-10-29: Dark values live in a namespaced mode extension

DTCG 2025.10 has no modes, so a semantic token's `$value` is its light value and `$extensions.keen.modes.dark` holds its dark value, both as references to primitives. The generator declares the light values on `:root`, and every token whose value depends on the mode again under both `[data-keen-mode="light"]` and `[data-keen-mode="dark"]`, so a host switches a page or a subtree by setting that attribute, including a light subtree inside a dark page. Mode-dependent tokens are declared again in each mode block because a custom property resolves its `var()` where it is declared.

Rejected: one token file per mode, which would duplicate every non-color token and let the files drift, and the separate DTCG resolver format, which no tool Keen uses reads yet. Moving to the resolver format later changes the token files and the generator, not the generated variable names.

### 2026-10-29: Host theme overrides are page-level

For Milestone 1, hosts override semantic and component tokens on `:root` and on the `[data-keen-mode]` selectors, the same places Keen declares them. Keen's tokens stay declared on `:root`, and a custom property resolves its `var()` where it is declared, so an override scoped to any other subtree does not reach the tokens that alias it: a subtree that sets `--keen-color-semantic-action` would leave `--keen-chat-message-user-background` on Keen's blue. The `fixture-astro` gate checks that the host's override reaches a component token that aliases it in the page, light, and dark contexts.

Subtree theming is deferred until a host needs two differently themed chats on one page. Supporting it means declaring dependent tokens again on a Keen root element, which changes the public theming surface. Rejected for now: re-declaring every semantic and component token on each Keen root, which doubles the stylesheet for a need no host has yet.

### 2026-10-29: The package is @keen/design-system with three entry points

`packages/keen` publishes as `@keen/design-system` with exactly three exports: `./react` for components, `./styles.css` for the generated token stylesheet followed by each component's styles, and `./tokens` for the typed token map of semantic and component tokens. There is no root export, so no internal module is importable; the build tier packs the package, installs the tarball into a scratch consumer, and fails if anything else resolves. The name and the `./react` and `./styles.css` paths follow the consumer sketch in the portfolio-blog integration plan.

`apps/fixture-astro` installs that tarball with npm rather than through the pnpm workspace, so it consumes the package the way a host does and never through a workspace link. Renaming the package later changes every host's imports, so the name should settle before a second consumer.

### 2026-10-29: The design's icons reach CI through a hash-pinned snapshot

*Superseded on 2026-10-30 by "The build reads the design file's JSON, and the pen CLI confirms it", below.*

The icon registry is generated from the icon nodes in `design/keen.pen`, which only a signed-in pen CLI can read, and CI has no pen credentials. `pnpm design:push` reads the icon nodes into `.keen/design/icons.json` together with the SHA-256 of `design/keen.pen`, and `pnpm tokens:build` generates the registry and the icons doc from that snapshot. CI fails when the design file's hash no longer matches the snapshot, so a design change cannot ship without re-reading its icons, and a run with the pen CLI also compares the snapshot with the live design.

Rejected: parsing `.pen` JSON directly, which ties Keen to a versioned file format Pen does not promise to keep, and adding pen credentials to CI, which puts a personal account secret in every workflow run.

### 2026-10-29: Keen's root element is marked with data-keen-root

Reduced-motion rules are scoped under `[data-keen-root]`, the attribute every Keen component's root element carries, and declared last in `styles.css`. A host's own elements, and any Keen variable a host reads outside a Keen component, keep their full motion. The attribute is a styling hook for Keen's own stylesheet, not a host API.
### 2026-10-30: The design file's variables are generated, and its layers use only variables

The design agent draws `design/keen.pen`; `pnpm tokens:build` writes its variables block from `tokens/*.json`, the same way it writes the CSS, and `tokens-generated` fails when that block is edited by hand. Every color on a layer is a variable, which `design-variables` enforces, so a token change reaches the design instead of leaving copies of the old value behind. Colors that exist only for the canvas (annotations and state-frame backgrounds) are tokens too, in `design/canvas.json`, and never reach the CSS, the typed map, or the baseline. `design/keen.variables.json`, a printed copy of the Pen variables, is deleted.

Rejected: keeping Pen's variables hand-maintained and comparing them with the contract, which leaves three copies of every value in sync by checks alone; and putting canvas colors in `tokens/*.json`, which would ship them to hosts. Width and height stay numbers, because Pen 0.3 cannot bind them to a variable; their tokens are named in layer metadata. Reverting means hand-editing the variables block again, which is what this removes.

### 2026-10-30: A Component Contract binds tokens and never copies their values

A contract names the tokens its parts use, in exact bindings: part, optional element, a CSS property, an optional interaction state (`focus`, `placeholder`, and so on), and the token. It stores no values: the Component Guide renders values and descriptions from `.keen/baselines/tokens.json`, and `tokens-contract` checks that each bound token exists with a type that fits its property. A binding the design cannot draw, such as padding the design replaces with a fixed height, says `drawn: false`. Required states are no longer listed in `contract.mjs`; each state must have a light and a dark design export instead.

This follows the "components as data" approach ([Nathan Curtis](https://medium.com/@nathanacurtis/components-as-data-2be178777f21); Adobe's [Spectrum component format](https://opensource.adobe.com/spectrum-design-data/spec/component-format/)): one file defines a component's parts, states, and token bindings, and the design, guide, and code are checked against it. Rejected: keeping values in the contract and gating them against the token files, which checks a copy that need not exist; and prose bindings ("title and detail size"), which no check can read. Adding a property to the vocabulary is a schema change, so the list grows only when a component needs it.

### 2026-10-30: Design layers link to contract parts by metadata, not by layer name

Each layer that draws a part carries `{ "type": "keen-part", "component", "part", "element" }` metadata, plus `sizes` for widths and heights. `design-anatomy` uses it to check that every part and element is drawn, that every token a layer uses is the one its part binds, and that every drawn binding appears in the design. Color and type properties inherit as CSS does: a label takes its color from the nearest part that binds one, and its font family from the component root. An instance override is checked against the part of the layer it restyles.

Rejected: matching layer names, which a rename breaks silently; Figma's Code Connect links by component key for the same reason. Known limit: the check confirms that a state binding's token is drawn somewhere, not in which state, because Pen overrides do not name the state they draw.

### 2026-10-30: The build reads the design file's JSON, and the pen CLI confirms it

`pnpm tokens:build` reads `design/keen.pen` as JSON: it writes the variables block and reads the icon nodes into `.keen/design/icons.json`, which is now a generated file that `tokens-generated` keeps current. `pnpm design:push`, `design/keen.variables.json`, and the snapshot's design hash are removed. With a signed-in pen CLI, `pen-live` and `icons-live` read the same file through Pen and fail if Pen sees different variables or icons; without one they are skipped.

This reverses the 2026-10-29 snapshot decision, which rejected parsing `.pen` JSON because Pen does not promise to keep its format. Two things changed. The variables block is now generated, so every token change rewrites the design file, and a hash of the whole file would have failed `icons-design` on each one, demanding a pen CLI that CI and most agents do not have. And the format risk now fails loudly: the build accepts only the Pen file versions it has been checked against (`2.21`), so a new format stops the build instead of being misread, and the live gates catch a difference whenever the CLI runs. Rejected: keeping the hash pin, which breaks on every token change; and writing through the pen CLI, which puts every token change behind a signed-in personal account. Supporting a new Pen version means checking the JSON reader against it and adding the version.
