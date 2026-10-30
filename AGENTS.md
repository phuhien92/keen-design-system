# Keen: rules for agents

These rules hold for any agent that edits tokens, the design file, a Component Contract, or component code. Each rule
has an example of the right way and the wrong way. `pnpm verify` enforces them, and its failure messages name the rule
that broke. The reasoning behind each rule is in [docs/decisions.md](docs/decisions.md).

## Where each thing lives

| You want to change                                          | Edit                                         | Never edit (generated)                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A token value                                               | `tokens/*.json`                              | `packages/keen/src/tokens/tokens.css`, `tokens.ts`, `.keen/baselines/tokens.json`, the `variables` block in `design/keen.pen` |
| A canvas color (annotations, frame backgrounds)             | `design/canvas.json`                         | the `variables` block in `design/keen.pen`                                                                                    |
| A screen, layer, or icon in the design                      | the layers (`children`) of `design/keen.pen` | its `variables` block, `.keen/design/icons.json`, `packages/keen/src/icons/registry.ts`                                       |
| What a component is, its parts, and which tokens style them | `docs/components/<name>.json`                | `docs/components/<name>.md`                                                                                                   |

After any of these edits, run:

```sh
pnpm tokens:build                       # writes the CSS, typed map, baseline, and Pen variables
node docs/components/contract.mjs render  # writes the Component Guides
pnpm verify && pnpm contract:check && pnpm test
```

## Tokens

**Change a value in the token files, then rebuild.** The build carries it to the CSS and the design.

```jsonc
// ✅ tokens/semantic.json
"action": { "$value": "{color.primitive.blue-700}", "$description": "Primary action fill, such as Send." }

// ❌ design/keen.pen: editing the generated variables block. tokens-generated fails:
//    "design/keen.pen is stale or hand-edited; run pnpm tokens:build"
"color.semantic.action": { "type": "color", "value": [{ "value": "#1D4ED8", "theme": { "mode": "light" } }, …] }
```

**A canvas color is a canvas token, not a product token.** It never reaches hosts.

```jsonc
// ✅ design/canvas.json
"annotation-note": { "$value": { "colorSpace": "srgb", "components": [0.2902, 0.3255, 0.3804], "hex": "#4A5361" },
                     "$description": "Note text beside a mockup.", "$extensions": { "keen": { "modes": { "dark": { … } } } } }

// ❌ tokens/semantic.json: a design-only color would ship in tokens.css and keenTokens
"annotation-note": { "$value": "{color.primitive.gray-600}", "$description": "Note text beside a mockup." }
```

## The design file

**Every color is a variable.** Never type a hex value on a layer, an override, or an annotation.

```jsonc
// ✅
{ "type": "frame", "name": "Send", "fill": "$color.semantic.action" }

// ❌ design-variables fails:
//    "design/keen.pen: Chat / Composer > Field > Send: fill is the typed-in color #2557D6; use $color.semantic.action"
{ "type": "frame", "name": "Send", "fill": "#2557D6" }
```

**Canvas variables color annotations only, and product variables color components only.**

```jsonc
// ✅ an annotation beside the mockup
{ "type": "text", "name": "Annotation / Title", "fill": "$canvas.annotation-title" }

// ❌ design-anatomy fails:
//    "design/keen.pen: Chat / Composer > Field > Send: uses $canvas.frame-background inside send; canvas variables color annotations only"
{ "type": "frame", "name": "Send", "fill": "$canvas.frame-background", "metadata": { "type": "keen-part", … } }
```

**Tag every layer that draws a part, with the part's name from the contract.** The tag, not the layer name, links the
design to the contract, so a renamed layer stays linked.

```jsonc
// ✅ the part itself, and an element inside it that the contract styles separately
{ "type": "frame", "name": "Chat / Composer", "metadata": { "type": "keen-part", "component": "Chat", "part": "composer" } }
{ "type": "frame", "name": "Field", "metadata": { "type": "keen-part", "component": "Chat", "part": "input", "element": "field" } }

// ❌ Send without its tag. It sits inside the tagged field, so it is checked as part of input.field and fails:
//    "design/keen.pen: Chat / Composer > Field > Send: draws background with $color.semantic.action,
//     but docs/components/chat.json binds input.field background → color.semantic.surface"
//    A layer with no tagged layer above it fails with "… draws no contract part; tag the layer with keen-part metadata".
{ "type": "frame", "name": "Send", "fill": "$color.semantic.action" }
```

**Tag an element only when the contract styles it separately.** An untagged layer inside a part takes its color and
type from the nearest tagged layer, as CSS inheritance would.

```jsonc
// ✅ the icon is untagged: it takes `send color → color.semantic.text-on-action` from its parent
{ "type": "frame", "name": "Send", "fill": "$color.semantic.action", "metadata": { "type": "keen-part", "component": "Chat", "part": "send" },
  "children": [{ "type": "icon", "name": "Send Icon", "fill": "$color.semantic.text-on-action" }] }

// ❌ tagging the icon as an element the contract does not declare. design-anatomy fails:
//    "design/keen.pen: Chat / Composer > Field > Send > Send Icon: keen-part names element send.icon,
//     which docs/components/chat.json does not declare"
{ "type": "icon", "name": "Send Icon", "metadata": { "type": "keen-part", "component": "Chat", "part": "send", "element": "icon" } }
```

**Name width and height tokens in `sizes`.** Pen 0.3 cannot bind width or height to a variable, so the number stays on
the layer and the token goes in the metadata.

```jsonc
// ✅
{ "type": "frame", "name": "Field", "height": 48,
  "metadata": { "type": "keen-part", "component": "Chat", "part": "input", "element": "field", "sizes": { "min-height": "chat.composer-height" } } }

// ❌ the 48 is unexplained. design-anatomy fails:
//    "docs/components/chat.json: binding input.field min-height → chat.composer-height is not drawn; draw it or mark it drawn: false"
{ "type": "frame", "name": "Field", "height": 48, "metadata": { "type": "keen-part", "component": "Chat", "part": "input", "element": "field" } }
```

**Add an icon by drawing it in the design, then rebuild.** `pnpm tokens:build` reads every icon node in
`design/keen.pen` into `.keen/design/icons.json` and the Lucide registry, the only module that imports Lucide.

```jsonc
// ✅ design/keen.pen, then pnpm tokens:build
{ "type": "icon", "name": "Bell Icon", "icon": "bell", "library": "lucide", "width": 18, "height": 18 }

// ❌ packages/keen/src/icons/registry.ts: a generated file. tokens-generated fails:
//    "packages/keen/src/icons/registry.ts is stale or hand-edited; run pnpm tokens:build"
"bell": Bell,
```

**Draw an interaction state as an override on an instance, using the token the contract binds for that state.**

```jsonc
// ✅ the contract binds `input.field border-color (focus) → color.semantic.focus`
{ "type": "ref", "ref": "rNbH6", "name": "Composer", "descendants": { "ObpBo": { "stroke": "$color.semantic.focus", "strokeWidth": 2 } } }

// ❌ a token the contract does not bind for that layer. design-anatomy fails:
//    "design/keen.pen: State 02 · loading · light > Chat > Composer (override of Field): draws border-color with
//     $color.semantic.action, but docs/components/chat.json binds input.field border-color → color.semantic.border-strong
//     or input.field border-color (focus) → color.semantic.focus"
{ "type": "ref", "ref": "rNbH6", "name": "Composer", "descendants": { "ObpBo": { "stroke": "$color.semantic.action" } } }
```

## Component Contracts

**Name tokens; never copy their values.** The Component Guide renders values from the baseline.

```jsonc
// ✅
{ "part": "send", "property": "background", "token": "color.semantic.action" }

// ❌ a copied value goes stale on the next token change, and the schema rejects it
{ "name": "color.semantic.action", "light": "#2557D6", "dark": "#86A8FF" }
```

**Write each binding as part, element, CSS property, state, and token: one property per binding.** The property comes
from the schema's list. `divider-color` is a one-sided border.

```jsonc
// ✅
{ "part": "offline-banner", "property": "divider-color", "token": "color.semantic.warning" },
{ "part": "offline-banner", "property": "color", "token": "color.semantic.warning" },
{ "part": "offline-banner", "element": "detail", "property": "color", "token": "color.semantic.text-primary" }

// ❌ prose no check can read, and three properties in one binding
{ "part": "offline-banner", "property": "divider, icon, and title color", "token": "color.semantic.warning" }
```

**Bind inherited properties on the part, not on every layer.** `color`, `font-family`, `font-size`, `font-weight`, and
`line-height` pass down to the layers inside a part; bind them on an element only when that element differs.

```jsonc
// ✅ the icon and title inherit warning; only the detail differs
{ "part": "offline-banner", "property": "color", "token": "color.semantic.warning" },
{ "part": "offline-banner", "element": "detail", "property": "color", "token": "color.semantic.text-primary" }

// ❌ an element per layer that repeats the part's value: more anatomy to keep in step for no difference
{ "part": "offline-banner", "element": "icon", "property": "color", "token": "color.semantic.warning" },
{ "part": "offline-banner", "element": "title", "property": "color", "token": "color.semantic.warning" }
```

**Declare an element in the anatomy before a binding uses it.**

```jsonc
// ✅ anatomy
{ "part": "input", "element": "textarea", "description": "Message input.", "elements": [{ "name": "field", "description": "The bordered field." }] }
// ✅ binding
{ "part": "input", "element": "field", "property": "background", "token": "color.semantic.surface" }

// ❌ contract:check fails: "bindings: input has no element \"wrapper\""
{ "part": "input", "element": "wrapper", "property": "background", "token": "color.semantic.surface" }
```

**Give a state-specific value a `state`.** Omit it for the resting state.

```jsonc
// ✅
{ "part": "input", "property": "color", "token": "color.semantic.text-primary" },
{ "part": "input", "property": "color", "state": "placeholder", "token": "color.semantic.text-subtle" }

// ❌ contract:check fails: "bindings: input color is bound twice"
{ "part": "input", "property": "color", "token": "color.semantic.text-primary" },
{ "part": "input", "property": "color", "token": "color.semantic.text-subtle" }
```

**Mark `drawn: false` only for a binding the design cannot draw**, and say why in the part's description or the design
note. Every other binding must appear in the design.

```jsonc
// ✅ the design draws the field at a fixed 48px height, so its block padding exists only in code
{ "part": "input", "element": "field", "property": "padding-block", "token": "space.semantic.inset-sm", "drawn": false }

// ❌ hiding a binding the design draws. design-anatomy fails:
//    "docs/components/chat.json: binding send background → color.semantic.action is drawn but marked drawn: false"
{ "part": "send", "property": "background", "token": "color.semantic.action", "drawn": false }
```

**Give every state a light and a dark design export.**

```jsonc
// ✅
{ "name": "loading", …, "evidence": ["design/exports/chat-02-loading-light.png", "design/exports/chat-02-loading-dark.png"] }

// ❌ contract:check fails: "states: loading has no dark design export"
{ "name": "loading", …, "evidence": ["design/exports/chat-02-loading-light.png"] }
```

## Component code

These rules cover everything in `packages/keen/src/components/<Name>/` and `packages/keen/src/icons/`. Stories and
tests are exempt.

**Expose no `className` or `style`, and spread no props.** Hosts customize through tokens, slots, and the props the
contract names, so Keen can change its internals without breaking them.

```tsx
// ✅ a slot from the contract
export interface ChatProps {
  labels: { title: string };
  header?: ReactNode;
}

// ❌ component-forwarding fails:
//    "packages/keen/src/components/Chat/Chat.tsx: props declare className, a styling escape hatch"
export interface ChatProps {
  labels: string;
  className?: string;
}

// ❌ "…/Chat.tsx: props use HTMLAttributes, which carries className and style"
export interface ChatProps extends HTMLAttributes<HTMLElement> { labels: string }

// ❌ "…/Chat.tsx: spreads props onto an element"
return <section className="keen-chat" {...props} />;
```

**Read semantic and component tokens only, and never declare one.** Hosts override tokens; components only read them.

```css
/* ✅ */
.keen-chat {
  background: var(--keen-color-semantic-surface);
}

/* ❌ token-reads fails: "…/Chat.css: reads primitive --keen-color-primitive-blue-600; components read semantic or component tokens" */
.keen-chat {
  background: var(--keen-color-primitive-blue-600);
}

/* ❌ "…/Chat.css: reads --keen-chat-bubble-background, which no token generates (phantom)" */
.keen-chat {
  background: var(--keen-chat-bubble-background);
}

/* ❌ "…/Chat.css: declares token --keen-color-semantic-action; only hosts override tokens" */
.keen-chat {
  --keen-color-semantic-action: #6d28d9;
}
```

**Read only the tokens your contract binds.** To use another token, add a binding to the contract first. Motion
tokens are the exception: no contract binds motion, and the motion rules below govern it.

```css
/* ✅ chat.json binds root background → color.semantic.surface */
.keen-chat {
  background: var(--keen-color-semantic-surface);
}

/* ❌ contract-roles fails: "…/Chat.css: reads icon.semantic.size-md, which chat.json does not bind" */
.keen-chat svg {
  width: var(--keen-icon-semantic-size-md);
}
```

**Animate with a named motion use: its duration, then its easing, in the `transition` or `animation` shorthand.** The
uses are `use-hover`, `use-message-enter`, `use-notice`, and `use-loop` in `tokens/semantic.json`.

```css
/* ✅ use-hover */
.keen-chat-send {
  transition: background-color var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-standard);
}

/* ❌ motion-usage fails: "…/Chat.css:<line>: literal duration or easing in transition; apply a named motion use" */
.keen-chat-send {
  transition: background-color 150ms ease;
}

/* ❌ "…/Chat.css:<line>: transition-duration splits a use; write the transition shorthand with a named use" */
.keen-chat-send {
  transition-duration: var(--keen-motion-semantic-duration-fast);
}
```

**Animate only opacity, transform, and colors.**

```css
/* ✅ */
.keen-chat-bubble {
  transition: opacity var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-standard);
}

/* ❌ motion-usage fails: "…/Chat.css:<line>: transitions width; animate only opacity, transform, and colors" */
.keen-chat-bubble {
  transition: width var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-standard);
}
```

**Register every looping and entrance animation, then rebuild.** Reduced motion parks a registered loop on its
`frame` and drops a registered entrance; the rebuild writes those rules into `reduced-motion.css`.

```jsonc
// ✅ packages/keen/src/motion/registry.json, then pnpm tokens:build
{ "loops": [{ "keyframes": "keen-pulse", "selector": ".keen-chat-dot", "frame": { "opacity": "1" } }], "entrances": [] }
```

```css
/* ❌ without the registry entry, motion-usage fails: "…/Chat.css:<line>: infinite animation keen-pulse is not in the loop registry"
   ❌ with the entry but without the rebuild, reduced-motion fails: "reduced-motion.css has no rule parking loop keen-pulse" */
.keen-chat-dot {
  animation: keen-pulse var(--keen-motion-semantic-duration-loop) var(--keen-motion-semantic-easing-linear) infinite;
}
```

**Scope any reduced-motion rule of your own to `[data-keen-root]`**, which every component's root element carries, so
a host's own motion is untouched.

```css
/* ✅ */
@media (prefers-reduced-motion: reduce) {
  [data-keen-root] .keen-chat-dot {
    opacity: 1;
  }
}

/* ❌ reduced-motion fails: "…/Chat.css: reduced-motion rule ".keen-chat-dot" is not scoped to [data-keen-root]" */
@media (prefers-reduced-motion: reduce) {
  .keen-chat-dot {
    opacity: 1;
  }
}
```

**Make an exception only with `ds-allow(<category>): <reason>`, on the same line as the declaration.** The categories
are `motion`, `icon-size`, and `color`. A comment on the line above does not attach to the declaration.

```css
/* ✅ */
.keen-chat-caret {
  transition: opacity 530ms steps(1); /* ds-allow(motion): the caret blinks at the platform's 530ms rate */
}

/* ❌ ds-allow fails: "…/Chat.css: unknown ds-allow category "timing"; use motion, icon-size, color" */
transition: opacity 530ms steps(1); /* ds-allow(timing): the caret blinks at the platform's 530ms rate */

/* ❌ "…/Chat.css: malformed "ds-allow(motion)"; write ds-allow(<category>): <reason>" */
transition: opacity 530ms steps(1); /* ds-allow(motion) */

/* ❌ on its own line, the exception does not apply, and motion-usage fails:
   "…/Chat.css:<line>: literal duration or easing in transition; apply a named motion use" */
/* ds-allow(motion): the caret blinks at the platform's 530ms rate */
transition: opacity 530ms steps(1);
```

**Use icons through `Icon`, with a glyph the design uses.** Only the generated registry imports Lucide.

```tsx
// ✅
<Icon name="arrow-up" />;

// ❌ icon-usage fails: "…/Chat.tsx: imports lucide-react; only packages/keen/src/icons/registry.ts may"
import { ArrowUp } from "lucide-react";

// ❌ "…/Chat.tsx: names icon "bell", which the design does not use". Draw the icon in the design first.
<Icon name="bell" />;
```

## Reading the design to write code

Start from a layer's `keen-part` tag, never from its name. For example, the layer tagged
`{ "part": "message-user", "element": "bubble" }`:

1. In the contract's `anatomy`, `message-user` is an `li`, and `bubble` is the element inside it that holds the text.
2. In `bindings`, `message-user` / `bubble` lists `background → chat.message-user-background`,
   `color → chat.message-user-text`, `radius → chat.message-radius`, and so on.
3. In code, read each token through `keenTokens`, never a primitive:
   `background: keenTokens.chat["message-user-background"]`, which is `var(--keen-chat-message-user-background)`.

## Adding a component

**Start every component with `pnpm new:component <Name>`.** It writes the contract, the component, its stylesheet,
story, and test, and the `./react` export, with the names every check links: the `Button/` folder, `button.json`,
the `button.*` token prefix, and the `keen-button` class. The code it writes passes every code check.

```text
✅ pnpm new:component ButtonGroup
   wrote docs/components/buttongroup.json
   wrote packages/keen/src/components/ButtonGroup/ButtonGroup.tsx
   …

❌ creating packages/keen/src/components/ButtonGroup/ by hand next to docs/components/button-group.json.
   contract-roles fails: "ButtonGroup: has no Component Contract at docs/components/buttongroup.json"
```

Then, for a Button:

1. Write the `TODO:` placeholders in `docs/components/button.json`: states, anatomy (parts, and elements where they
   are styled separately), API, bindings, contrast pairs, keyboard, focus, and screen-reader rules.
2. Add the `button.*` tokens to `tokens/component.json`, plus any new semantic role to `tokens/semantic.json`, each
   with a `$description`. Run `pnpm tokens:build`.
3. Draw one frame per state, in light and in dark, in `design/keen.pen`: variables only, every part tagged. Export
   each frame to `design/exports/button-<nn>-<state>-<mode>.png`.
4. Run `node docs/components/contract.mjs render`, then `pnpm verify`, `pnpm contract:check`, and `pnpm test`.
5. Build the component in `packages/keen/src/components/Button/`, with a story for each state.

Until the design is drawn, the checks fail on exactly that, and the failures are the to-do list:

```text
design-anatomy:  "docs/components/button.json: root is not drawn; no layer carries its keen-part metadata"
contract:check:  "missing file design/exports/button-01-default-light.png"
```

**Keep a contract `proposed` until every placeholder is written.**

```jsonc
// ✅ while any TODO: remains
"status": "proposed"

// ❌ contract:check fails: "status: approved with TODO placeholders left; write them, or keep it proposed"
"status": "approved"
```

## Pull requests

**Keep each pull request to about 400 hand-written lines, added plus deleted.** Reviewers catch fewer defects past
that, so split larger work into stacked pull requests: each targets the previous one's branch and passes CI on its
own. Generated files do not count: `pnpm-lock.yaml`, `tokens.css`, `tokens.ts`, the baseline, and the Component
Guides. `design/keen.pen` does not count either; a design change is reviewed through its exports and the design checks.
Measure before opening the pull request:

```sh
git diff --numstat origin/<base>...HEAD -- . ':!pnpm-lock.yaml' ':!packages/keen/src/tokens/tokens.*' \
  ':!.keen/baselines/**' ':!docs/components/*.md' ':!design/keen.pen' | awk '{ n += $1 + $2 } END { print n }'
```

```text
✅ Adding a Button, in three stacked pull requests:
   1. docs/components/button.json and the button.* tokens                (~250 lines)
   2. the Button design frames, exports, and keen-part tags              (~50 lines, plus design/keen.pen)
   3. packages/keen/src/components/Button/, stories, and tests           (~350 lines)

❌ All of it in one pull request: ~650 hand-written lines, so the contract, the design, and the code are reviewed
   together and none of them closely.
```

**Put a mechanical migration in its own pull request**, with the script that made it and the assertion that proves
it, so a reviewer checks the script instead of every changed line.

```text
✅ "Replace typed-in colors with canvas variables": the diff touches ~1,000 lines of design/keen.pen, and the
   description includes the migration script and its result: "180 replaced, each equal to its variable's value
   in that frame's mode; 0 left."

❌ The same 1,000 lines inside a pull request that also adds a new gate, so the reviewer cannot tell the mechanical
   lines from the ones that need judgment.
```

**Say in the description when a pull request goes over the limit, and why it could not be split.** No check enforces
this rule yet; the reviewer does.
