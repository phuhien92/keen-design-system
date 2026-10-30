# Motion

Keen's motion is a small set of semantic roles and named uses, generated from `tokens/primitive.json` and `tokens/semantic.json` like every other token. Components read only semantic roles, never a `motion.primitive.*` value, and apply motion through a named use.

## Roles and uses

The tables below are generated from the token files by `pnpm tokens:build`; `pnpm verify` fails if they are stale.

<!-- generated:start -->
| Role | Value | JavaScript | Intended use |
| --- | --- | --- | --- |
| `motion.semantic.duration-base` | 200ms | schedule | Color and opacity changes. Collapses to 0.01ms under reduced motion. |
| `motion.semantic.duration-fast` | 150ms | schedule | Hover and icon changes. Collapses to 0.01ms under reduced motion. |
| `motion.semantic.duration-instant` | 75ms | schedule | Near-immediate feedback, such as the composer growing a line. Collapses to 0.01ms under reduced motion. |
| `motion.semantic.duration-loop` | 1400ms | pace | One cycle of a looping indicator, such as the loading dots. Registered loops park on a static frame under reduced motion. |
| `motion.semantic.duration-slow` | 300ms | schedule | A notice or message appearing. Collapses to 0.01ms under reduced motion. |
| `motion.semantic.easing-emphasized` | cubic-bezier(0.2, 0, 0, 1) |  | Curve for a change the user should notice. Not used by any named use yet. |
| `motion.semantic.easing-entrance` | cubic-bezier(0, 0, 0.2, 1) |  | Decelerating curve for content entering the view. Entrances are dropped under reduced motion. |
| `motion.semantic.easing-linear` | linear |  | Constant rate for loops, such as the loading dots. |
| `motion.semantic.easing-standard` | cubic-bezier(0.4, 0, 0.2, 1) |  | Default curve for state changes that start and end on screen. |

| Use | Duration | Easing | Intended use |
| --- | --- | --- | --- |
| `motion.semantic.use-hover` | `motion.semantic.duration-fast` | `motion.semantic.easing-standard` | Hover and press feedback on controls. Expanded where applied; never a custom property. |
| `motion.semantic.use-loop` | `motion.semantic.duration-loop` | `motion.semantic.easing-linear` | One cycle of a registered looping animation, such as the loading dots or streaming caret. |
| `motion.semantic.use-message-enter` | `motion.semantic.duration-slow` | `motion.semantic.easing-entrance` | A new message entering the log. An entrance: dropped under reduced motion. |
| `motion.semantic.use-notice` | `motion.semantic.duration-slow` | `motion.semantic.easing-standard` | A notice or banner appearing or leaving. |
<!-- generated:end -->

## Applying a use

A component picks a use, not a duration and an easing separately. It writes the use's two variables together in a `transition` or `animation` shorthand, and animates only `opacity`, `transform`, and colors:

```css
.keen-chat__send {
  transition: background-color var(--keen-motion-semantic-duration-fast) var(--keen-motion-semantic-easing-standard);
}
```

Uses are never emitted as custom properties. A variable defined on `:root` resolves once there, so the reduced-motion rule scoped to Keen's root could not reach it. Reading a `--keen-motion-semantic-use-*` variable fails `pnpm verify` as a phantom token.

## Reduced motion

Under `prefers-reduced-motion: reduce`, the generated `reduced-motion.css`, declared last in `styles.css`:

- sets every semantic duration to `0.01ms` (not `0`, so transition-end events still fire), scoped to Keen's root element `[data-keen-root]`, never `:root` or `*` on the host page;
- sets `scroll-behavior: auto` within Keen's root, so scrolling to the newest message jumps;
- parks every loop listed in `packages/keen/src/motion/registry.json` on its static frame, because at `0.01ms` a loop would flash instead of stopping;
- drops every registered entrance animation outright instead of speeding it up.

JavaScript timers read `packages/keen/src/tokens/motion.ts`, generated from the same tokens. A `schedule` timing (when something starts or is removed) is unchanged under reduced motion; for a `pace` timing (an animation rate) the component checks reduced motion and skips the animation.

## Sanctioned exceptions

A deliberate off-token value needs a `ds-allow(<category>): <reason>` comment on the same line, with category `motion`, `icon-size`, or `color`. An unknown or misspelled category fails `pnpm verify`.

## Adding to the system

1. A new value goes in `tokens/primitive.json` as a `motion.primitive.*` duration or cubic Bézier.
2. A new role goes in `tokens/semantic.json`, referencing a primitive, with a `$description`, and a `$extensions.keen.js` tag of `schedule` or `pace` if JavaScript uses it.
3. A new use is a `transition` composite in `tokens/semantic.json`, added in the same change as the component code that applies it.
4. A new looping or entrance animation is listed in `packages/keen/src/motion/registry.json` in the same change.
5. Run `pnpm tokens:build` and review the baseline diff.
