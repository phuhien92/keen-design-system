# Icons

Keen uses one icon set, [Lucide](https://lucide.dev), the family the Pen design uses. The design is the source of which icons exist: `pnpm design:push` reads every icon node in `design/keen.pen` through the pen CLI into `.keen/design/icons.json`, and `pnpm tokens:build` generates `packages/keen/src/icons/registry.ts`, the only module that imports from Lucide, and the table below. Nobody edits the registry by hand; to add an icon, add it in the design and regenerate.

Generation fails when a design icon is not from the Lucide family or names a glyph Lucide does not have. `pnpm verify` fails when the registry is stale, when `design/keen.pen` changed since the snapshot was taken, when anything outside the registry imports Lucide, or when component code names a glyph the registry lacks. The icon set belongs to Keen, so hosts cannot swap icons.

## Glyphs

<!-- generated:start -->
| Glyph | Lucide component | Design layers | Design sizes |
| --- | --- | --- | --- |
| `arrow-up` | `ArrowUp` | Send Icon | 18px |
| `circle-alert` | `CircleAlert` | Error Icon | 18px |
| `clock-4` | `Clock4` | Rate Limit Icon | 18px |
| `rotate-ccw` | `RotateCcw` | Retry Icon | 12px |
| `sparkles` | `Sparkles` | Sparkles | 22px |
| `square` | `Square` | Status Icon, Stop Icon | 12px |
| `wifi-off` | `WifiOff` | Offline Icon | 18px |
<!-- generated:end -->

## Sizing

Icons are sized through `--keen-icon-size`, never `font-size`, set from `icon.semantic.size-sm` (12px, compact controls and status lines) or `icon.semantic.size-md` (18px, Send and notices). Icons inherit `currentColor`, so their color comes from the text role of the part they sit in. The design's 22px empty-state icon has no size role yet; Plan 02 adds one or a sanctioned `ds-allow(icon-size)` exception when it builds the empty state.

## Labelling

Components render icons through the internal `Icon` component:

- By default an icon is decorative: `aria-hidden="true"`, because the control around it carries the accessible name.
- An icon that stands alone and conveys meaning takes a `label`, which renders `role="img"` and `aria-label`.
- Never pass label text to `aria-labelledby`, which takes element IDs.
