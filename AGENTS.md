# Keen: rules for agents

These rules hold for any agent that edits tokens, the design file, a Component Contract, or component code. Each rule
has an example of the right way and the wrong way. `pnpm verify` enforces them, and its failure messages name the rule
that broke. The reasoning behind each rule is in [docs/decisions.md](docs/decisions.md).

## Where each thing lives

| You want to change                                          | Edit                                         | Never edit (generated)                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A token value                                               | `tokens/*.json`                              | `packages/keen/src/tokens/tokens.css`, `tokens.ts`, `.keen/baselines/tokens.json`, the `variables` block in `design/keen.pen` |
| A canvas color (annotations, frame backgrounds)             | `design/canvas.json`                         | the `variables` block in `design/keen.pen`                                                                                    |
| A screen or layer in the design                             | the layers (`children`) of `design/keen.pen` | its `variables` block                                                                                                         |
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

## Reading the design to write code

Start from a layer's `keen-part` tag, never from its name. For example, the layer tagged
`{ "part": "message-user", "element": "bubble" }`:

1. In the contract's `anatomy`, `message-user` is an `li`, and `bubble` is the element inside it that holds the text.
2. In `bindings`, `message-user` / `bubble` lists `background → chat.message-user-background`,
   `color → chat.message-user-text`, `radius → chat.message-radius`, and so on.
3. In code, read each token through `keenTokens`, never a primitive:
   `background: keenTokens.chat["message-user-background"]`, which is `var(--keen-chat-message-user-background)`.

## Adding a component

Example: a Button.

1. Write `docs/components/button.json` with `status: "proposed"`: states, anatomy (parts, and elements where they are
   styled separately), API, bindings, contrast pairs, keyboard, focus, and screen-reader rules.
2. Add the `button.*` tokens to `tokens/component.json`, plus any new semantic role to `tokens/semantic.json`, each
   with a `$description`. Run `pnpm tokens:build`.
3. Draw one frame per state, in light and in dark, in `design/keen.pen`: variables only, every part tagged. Export
   each frame to `design/exports/button-<nn>-<state>-<mode>.png`.
4. Run `node docs/components/contract.mjs render`, then `pnpm verify`, `pnpm contract:check`, and `pnpm test`.
5. Build the component in `packages/keen/src/components/Button/`.
