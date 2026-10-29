# Chat — Component Guide

> Generated from [`chat.json`](chat.json) by `node docs/components/contract.mjs render`. The Component Contract `chat.json` is authoritative: if this guide and the contract ever disagree, the contract wins. Edit the contract and regenerate; `node docs/components/contract.mjs check` fails while they differ.

**Status:** proposed · contract 0.2.0

A provider-agnostic AI chat panel. Keen renders the conversation, streams the assistant reply, and owns keyboard, focus, and screen-reader behavior. The host connects its AI provider through an adapter and keeps the conversation.

**Design:** [`design/keen.pen`](../../design/keen.pen), with its Pen variables, generated from the DTCG tokens, read back into [`design/keen.variables.json`](../../design/keen.variables.json). The .pen file is a visual review artifact, not a token source. Its variables are generated from the DTCG tokens by pnpm design:push and named after tier token paths. Pen 0.3 cannot bind width or height to a variable, so chat.message-max-width and chat.composer-height are applied as numbers and named in those layers' metadata. The rate-limit notice names chat.composer-height as its minimum height in metadata and otherwise fits its content. The user bubble's chat.message-max-width binding is an implementation decision; the design's user bubble carries no width metadata.

## Host boundary

| Keen owns | The host owns |
| --- | --- |
| Chat UI and layout | AI provider and model |
| State machine and streaming behavior | Credentials and network calls |
| Keyboard, focus, and screen-reader behavior | Conversation persistence |
| Tokens and override points | Conversation lifecycle: when a chat starts, resets, or is discarded |
| Component docs | Rate limits and connectivity: whether a limit applies, its retry time, and whether the user is online |
|  | Product copy passed through labels and slots |

## States

| State | What the user sees | Composer | Partial response | Announcement | Design |
| --- | --- | --- | --- | --- | --- |
| `empty` | No messages yet. The empty slot and optional suggestions fill the log. | Send | none | Nothing is announced. | [light](../../design/exports/chat-01-empty-light.png) · [dark](../../design/exports/chat-01-empty-dark.png) |
| `loading` | The request is sent and no text has arrived. A pending message shows the thinking label. | Stop | none | The live region says the thinking label once. | [light](../../design/exports/chat-02-loading-light.png) · [dark](../../design/exports/chat-02-loading-dark.png) |
| `streaming` | Text chunks append to the assistant message, which is marked busy. | Stop | growing | Only newly appended text is announced, flushed at sentence ends. | [light](../../design/exports/chat-03-streaming-light.png) · [dark](../../design/exports/chat-03-streaming-dark.png) |
| `completed` | The adapter finished. The full response is in the log. | Send | none | Any unannounced remainder is flushed. The full message is not re-read. | [light](../../design/exports/chat-04-completed-light.png) · [dark](../../design/exports/chat-04-completed-dark.png) |
| `error` | The adapter failed before any text arrived. An error notice with Retry follows the user message. | Send | none | The error notice is a role=alert region, announced once. | [light](../../design/exports/chat-05-error-light.png) · [dark](../../design/exports/chat-05-error-dark.png) |
| `stopped` | The user stopped generation. The partial response stays and shows the stopped status. | Send | kept | The live region says the stopped label. | [light](../../design/exports/chat-06-stopped-light.png) · [dark](../../design/exports/chat-06-stopped-dark.png) |
| `error-mid-stream` | The adapter failed after text arrived. The partial response stays and an error notice with Retry follows it. | Send | kept | The error notice is a role=alert region, announced once. | [light](../../design/exports/chat-07-error-mid-stream-light.png) · [dark](../../design/exports/chat-07-error-mid-stream-dark.png) |
| `rate-limited` | The host reported a rate limit. A notice with a countdown to the retry time, or a fallback detail without one, replaces the input. The log is unchanged. | Rate-limit notice | unchanged | The notice is a polite role=status region, announced once with the retry time. Countdown ticks are not announced. | [light](../../design/exports/chat-08-rate-limited-light.png) · [dark](../../design/exports/chat-08-rate-limited-dark.png) |
| `offline` | The host reports no connection. A banner shows below the header and Send is disabled; the input still takes a draft. The log is unchanged. | Send, disabled | unchanged | The banner is a polite role=status region, announced once. The live region says the back-online label on reconnect. | [light](../../design/exports/chat-09-offline-light.png) · [dark](../../design/exports/chat-09-offline-dark.png) |

| From | Event | To |
| --- | --- | --- |
| `empty`, `completed`, `error`, `stopped`, `error-mid-stream` | submit | `loading` |
| `loading` | first chunk | `streaming` |
| `streaming` | adapter finishes | `completed` |
| `loading` | adapter throws | `error` |
| `streaming` | adapter throws | `error-mid-stream` |
| `loading`, `streaming` | stop | `stopped` |
| `error` | retry: resend the same request | `loading` |
| `error-mid-stream` | retry: drop the partial, resend the same request | `loading` |
| `empty`, `completed`, `error`, `stopped`, `error-mid-stream` | host sets a rateLimit that applies, or a limit applies when this state is entered | `rate-limited` |
| `rate-limited` | retryAt passes or host sets rateLimit to null | the state it interrupted |
| `empty`, `completed`, `error`, `stopped`, `error-mid-stream` | host sets online to false, or online is still false when this state is entered | `offline` |
| `offline` | host sets online to true | the state it interrupted |

## Anatomy

| Part | Element | Pen layer | Description |
| --- | --- | --- | --- |
| `root` | `section` | Chat | The panel. Fills the box the host gives it. |
| `header` (slot) | `header` | Header (slot: header) | Shows labels.title, or the header slot. |
| `offline-banner` | `div[role=status]` | Chat / Notice / Offline | Icon, title, and detail. Shown below the header while online is false. |
| `log` | `div > ol` | Message log | Scrollable conversation. One li per message, notice, or pending reply. |
| `message-user` | `li` | Chat / Message / User | User text in an end-aligned bubble. |
| `message-assistant` | `li` | Chat / Message / Assistant | Assistant text in a start-aligned bubble, plus a status line when stopped. |
| `message-pending` | `li` | Chat / Message / Pending | Thinking indicator shown while loading. |
| `error-notice` | `li > div[role=alert]` | Chat / Notice / Error | Error title, detail, and the Retry button. |
| `empty` (slot) | `div` | Empty state (slot: empty) | Default icon, title, and body, or the empty slot. |
| `suggestion` | `button` | Suggestion | One per suggestions entry, below the empty content. Sends its text. |
| `composer` | `form` | Chat / Composer | Message input and the Send or Stop action. |
| `input` | `textarea` | Input | Message input with a visually hidden label. |
| `send` | `button[type=submit]` | Send | Icon button. Disabled while the input is empty; aria-disabled while offline. |
| `stop` | `button[type=button]` | Stop | Replaces Send while loading or streaming. |
| `rate-limit-notice` | `div[role=status]` | Chat / Notice / Rate limit | Icon, title, and the countdown or fallback detail. Replaces the input and Send while rate limited; the composer keeps its padding and divider. |
| `live-region` | `div[aria-live=polite]` | not drawn | Visually hidden. Carries loading, streaming, stopped, back-online, and limit-lifted announcements. |

## API

```ts
type ChatRole = "user" | "assistant";
interface ChatMessage { id: string; role: ChatRole; content: string; status?: "complete" | "stopped" | "error"; }
interface ChatRequest { messages: readonly ChatMessage[]; }
interface ChatAdapter { send(request: ChatRequest, signal: AbortSignal): AsyncIterable<string>; }
interface ChatRateLimit { retryAt?: Date; }
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `adapter` | `ChatAdapter` | required | Host connection to the AI provider. send yields text chunks, throws on failure, and should stop when signal aborts. |
| `initialMessages` | `readonly ChatMessage[]` | `[]` | Conversation to restore on mount. An empty list starts in the empty state. |
| `onMessagesChange` | `(messages: readonly ChatMessage[]) => void` |  | Called with the full list whenever a message is added, removed, or reaches a terminal status, including when Retry drops a partial response. Not called per chunk. The host persists from here. |
| `onError` | `(error: unknown) => void` |  | Called with the adapter error on entering error or error-mid-stream. |
| `labels` | `Partial<ChatLabels>` | `api.labels` | All visible and announced copy. ChatLabels has one string per key in api.labels; omitted keys use those English defaults. |
| `suggestions` | `readonly string[]` | `[]` | Prompts shown in the empty state. Activating one sends its text. |
| `online` | `boolean` | `true` | Host connectivity signal, for example from navigator.onLine and the online and offline events. While false, the chat is offline. |
| `rateLimit` | `ChatRateLimit \| null` | `null` | Set by the host when its server reports a limit. While a limit applies, the chat is rate limited. retryAt is when sending is allowed again and enables the countdown. |
| `header` | `ReactNode` |  | Slot. Replaces the default header content. The region keeps labels.title as its name. |
| `empty` | `ReactNode` |  | Slot. Replaces the default empty-state icon, title, and body. Suggestions still render below it. |

Default labels (`api.labels`):

| Key | Default |
| --- | --- |
| `title` | Assistant |
| `conversation` | Conversation |
| `input` | Message |
| `placeholder` | Ask a question… |
| `send` | Send |
| `stop` | Stop |
| `retry` | Retry |
| `thinking` | Thinking… |
| `stopped` | Response stopped |
| `errorTitle` | Couldn't get a response. |
| `errorDetail` | Check your connection, then retry. |
| `interruptedTitle` | Response interrupted. |
| `interruptedDetail` | The partial reply above is kept. Retry replaces it. |
| `userName` | You |
| `assistantName` | Assistant |
| `emptyTitle` | How can I help? |
| `emptyBody` | Ask a question to get started. |
| `rateLimitTitle` | Message limit reached. |
| `rateLimitCountdown` | You can send again in {time}. |
| `rateLimitUntil` | You can send again at {time}. |
| `rateLimitDetail` | Try again in a little while. |
| `rateLimitLifted` | You can send messages again. |
| `offlineTitle` | You're offline. |
| `offlineDetail` | Your draft is kept. Send works again when you reconnect. |
| `backOnline` | Back online. |

- Submitting trims the input, appends a user message, clears the input, and calls adapter.send with the conversation.
- Stop aborts the signal and ignores any later chunks; an abort rejection after Stop is not an error.
- Stopping before any text keeps no assistant bubble; the stopped status line still shows.
- Retry after error-mid-stream removes the partial assistant message before resending.
- To reset a conversation, the host remounts Chat with a new key and initialMessages.
- online and rateLimit are host signals. Keen never detects connectivity or limits and never reconnects or retries on its own; a request that fails goes to error or error-mid-stream as usual.
- While online is false, the input still takes a draft, but Enter, Send, Retry, and suggestions do not send. When online turns true, the banner goes and the live region says labels.backOnline.
- A limit applies while rateLimit is set and its retryAt, if any, has not passed. Once retryAt passes, the limit no longer applies even if the host leaves rateLimit set, until the host passes a new rateLimit. While a limit applies, the rate-limit notice replaces the input and the draft is kept for when the input returns. Enter, Send, Retry, and suggestions do not send. With retryAt, the notice shows labels.rateLimitCountdown with {time} as the remaining m:ss; without it, labels.rateLimitDetail.
- The input returns when retryAt passes or the host sets rateLimit to null, whichever is first, and the live region says labels.rateLimitLifted.
- Each signal is tracked on its own: the banner shows while online is false and the notice replaces the input while a limit applies, whichever state is active, so both can apply at once. Neither signal changes the log, so leaving rate-limited or offline returns to the state it interrupted, and the other state follows at once only if online is still false or a limit still applies. If both apply when a state is entered, rate-limited is entered.
- Set during loading or streaming, neither signal interrupts the reply: the banner shows at once with Stop still available, and the notice waits for the reply to end. When the reply ends, the chat enters rate-limited if a limit applies, or offline if online is still false. A host that learns of a limit from a failed send can set rateLimit from onError; the error notice stays, with Retry disabled until the limit lifts.

## Customization

- **Component tokens:** `chat.composer-height`, `chat.message-gap`, `chat.message-max-width`, `chat.message-radius`, `chat.message-user-background`, `chat.message-user-text`, `chat.message-assistant-background`
- **Variants:** none
- **Slots:** `header`, `empty`

With semantic tokens, these are the only supported customization surface. Chat has no variants in 0.2.0. It forwards no className or style to its internals, and internal selectors are not stable. A need these cannot meet becomes a reviewed Keen change.

## Tokens

Values resolved from the DTCG token files (`tokens/*.json`), the only token source. `contract.mjs check` fails if this table and the tokens differ.

| Token | Type | Light | Dark | Intended use |
| --- | --- | --- | --- | --- |
| `color.semantic.surface` | color | `#FFFFFF` | `#0F1115` | Main background of panels and controls. Pairs with text-primary and text-subtle. |
| `color.semantic.surface-raised` | color | `#F2F4F7` | `#1C2029` | Background a step above surface: assistant messages, suggestions, and the rate-limit notice. |
| `color.semantic.text-primary` | color | `#101828` | `#F2F4F7` | Body text on surface, surface-raised, danger-surface, and warning-surface. |
| `color.semantic.text-subtle` | color | `#475467` | `#A3ABB8` | Secondary text: placeholders, status, empty body. Still meets 4.5:1 on surface and surface-raised. |
| `color.semantic.border` | color | `#E4E7EC` | `#262B35` | Decorative dividers and outlines that are not needed to identify a control. |
| `color.semantic.border-strong` | color | `#7A8394` | `#6E7787` | Control boundaries that identify an input or button. Meets 3:1 on surface. |
| `color.semantic.action` | color | `#2557D6` | `#86A8FF` | Primary action fill, such as Send. Pairs with text-on-action. |
| `color.semantic.text-on-action` | color | `#FFFFFF` | `#0B1020` | Text and icons on action fills. |
| `color.semantic.focus` | color | `#1D4ED8` | `#A4BEFF` | Focus ring. Meets 3:1 on surface. |
| `color.semantic.danger` | color | `#B42318` | `#FF9C94` | Error text, icons, and outlines. Meets 4.5:1 on danger-surface. |
| `color.semantic.danger-surface` | color | `#FEF3F2` | `#2B1717` | Background of error notices. |
| `color.semantic.warning` | color | `#B54708` | `#FDB022` | Warning text, icons, and dividers, such as the offline banner's. Meets 4.5:1 on warning-surface. |
| `color.semantic.warning-surface` | color | `#FFFAEB` | `#2B2114` | Background of warning banners. |
| `space.semantic.inset-sm` | dimension | 8 | same | Compact padding: vertical bubble padding, chips, field trailing edge. |
| `space.semantic.inset-md` | dimension | 16 | same | Default padding inside surfaces: panel sections and horizontal bubble padding. |
| `space.semantic.gap-sm` | dimension | 8 | same | Gap between items in a row or a short stack. |
| `radius.semantic.control` | dimension | 8 | same | Corner radius of inputs, buttons, chips, and notices. |
| `radius.semantic.container` | dimension | 12 | same | Corner radius of panels. |
| `font.semantic.family-body` | fontFamily | "Inter", system-ui, sans-serif | same | Typeface for all chat text. |
| `font.semantic.weight-strong` | fontWeight | 600 | same | Weight for titles and button labels. |
| `font.semantic.size-body` | dimension | 15 | same | Message and input text size. |
| `font.semantic.size-caption` | dimension | 13 | same | Status lines, notices, chips, and button labels. |
| `font.semantic.size-title` | dimension | 16 | same | Header title and empty-state title. |
| `font.semantic.line-height-body` | number | 1.5 | same | Line height multiplier for message text. |
| `chat.composer-height` | dimension | 48 | same | Minimum height of the composer field and the rate-limit notice. Fits a 32px button with inset-sm above and below. |
| `chat.message-gap` | dimension | 16 | same | Vertical gap between items in the message log. |
| `chat.message-max-width` | dimension | 320 | same | Maximum bubble width. Bubbles never exceed the log width. |
| `chat.message-radius` | dimension | 16 | same | Corner radius of message bubbles. |
| `chat.message-user-background` | color | → `color.semantic.action` | → `color.semantic.action` | User bubble fill. Override with chat.message-user-text to keep 4.5:1. |
| `chat.message-user-text` | color | → `color.semantic.text-on-action` | → `color.semantic.text-on-action` | User bubble text. |
| `chat.message-assistant-background` | color | → `color.semantic.surface-raised` | → `color.semantic.surface-raised` | Assistant and pending bubble fill. Pairs with text-primary. |

## Token bindings

| Part | Property | Token |
| --- | --- | --- |
| `root` | background | `color.semantic.surface` |
| `root` | border | `color.semantic.border` |
| `root` | radius | `radius.semantic.container` |
| `root` | font-family | `font.semantic.family-body` |
| `header` | padding | `space.semantic.inset-md` |
| `header` | divider | `color.semantic.border` |
| `header` | title color | `color.semantic.text-primary` |
| `header` | title size | `font.semantic.size-title` |
| `header` | title weight | `font.semantic.weight-strong` |
| `header` | title line height | `font.semantic.line-height-body` |
| `offline-banner` | background | `color.semantic.warning-surface` |
| `offline-banner` | divider, icon, and title color | `color.semantic.warning` |
| `offline-banner` | padding block | `space.semantic.inset-sm` |
| `offline-banner` | padding inline | `space.semantic.inset-md` |
| `offline-banner` | gap | `space.semantic.gap-sm` |
| `offline-banner` | title and detail size | `font.semantic.size-caption` |
| `offline-banner` | title weight | `font.semantic.weight-strong` |
| `offline-banner` | detail color | `color.semantic.text-primary` |
| `log` | padding | `space.semantic.inset-md` |
| `log` | gap | `chat.message-gap` |
| `message-user` | background | `chat.message-user-background` |
| `message-user` | text color | `chat.message-user-text` |
| `message-user` | radius | `chat.message-radius` |
| `message-user` | max width | `chat.message-max-width` |
| `message-user` | padding block | `space.semantic.inset-sm` |
| `message-user` | padding inline | `space.semantic.inset-md` |
| `message-user` | text size | `font.semantic.size-body` |
| `message-user` | line height | `font.semantic.line-height-body` |
| `message-assistant` | background | `chat.message-assistant-background` |
| `message-assistant` | text color | `color.semantic.text-primary` |
| `message-assistant` | radius | `chat.message-radius` |
| `message-assistant` | max width | `chat.message-max-width` |
| `message-assistant` | padding block | `space.semantic.inset-sm` |
| `message-assistant` | padding inline | `space.semantic.inset-md` |
| `message-assistant` | text size | `font.semantic.size-body` |
| `message-assistant` | line height | `font.semantic.line-height-body` |
| `message-assistant` | status color | `color.semantic.text-subtle` |
| `message-assistant` | status size | `font.semantic.size-caption` |
| `message-pending` | background | `chat.message-assistant-background` |
| `message-pending` | radius | `chat.message-radius` |
| `message-pending` | padding block | `space.semantic.inset-sm` |
| `message-pending` | padding inline | `space.semantic.inset-md` |
| `message-pending` | gap | `space.semantic.gap-sm` |
| `message-pending` | dots and label color | `color.semantic.text-subtle` |
| `message-pending` | label size | `font.semantic.size-caption` |
| `error-notice` | background | `color.semantic.danger-surface` |
| `error-notice` | border and title color | `color.semantic.danger` |
| `error-notice` | radius | `radius.semantic.control` |
| `error-notice` | padding block | `space.semantic.inset-sm` |
| `error-notice` | padding inline | `space.semantic.inset-md` |
| `error-notice` | gap | `space.semantic.gap-sm` |
| `error-notice` | title and detail size | `font.semantic.size-caption` |
| `error-notice` | title weight | `font.semantic.weight-strong` |
| `error-notice` | detail color | `color.semantic.text-primary` |
| `error-notice` | retry background | `color.semantic.surface` |
| `error-notice` | retry border | `color.semantic.border-strong` |
| `error-notice` | retry radius | `radius.semantic.control` |
| `error-notice` | retry icon and label color | `color.semantic.text-primary` |
| `error-notice` | retry label size | `font.semantic.size-caption` |
| `error-notice` | retry label weight | `font.semantic.weight-strong` |
| `empty` | icon background | `color.semantic.surface-raised` |
| `empty` | icon color | `color.semantic.action` |
| `empty` | title color | `color.semantic.text-primary` |
| `empty` | title size | `font.semantic.size-title` |
| `empty` | title weight | `font.semantic.weight-strong` |
| `empty` | body color | `color.semantic.text-subtle` |
| `empty` | body size | `font.semantic.size-body` |
| `empty` | line height | `font.semantic.line-height-body` |
| `empty` | suggestions gap | `space.semantic.gap-sm` |
| `suggestion` | background | `color.semantic.surface-raised` |
| `suggestion` | border | `color.semantic.border` |
| `suggestion` | radius | `radius.semantic.control` |
| `suggestion` | padding block | `space.semantic.inset-sm` |
| `suggestion` | padding inline | `space.semantic.inset-md` |
| `suggestion` | text color | `color.semantic.text-primary` |
| `suggestion` | text size | `font.semantic.size-caption` |
| `composer` | padding | `space.semantic.inset-md` |
| `composer` | divider | `color.semantic.border` |
| `input` | field background | `color.semantic.surface` |
| `input` | field min height | `chat.composer-height` |
| `input` | field border | `color.semantic.border-strong` |
| `input` | focus ring | `color.semantic.focus` |
| `input` | field radius | `radius.semantic.control` |
| `input` | field padding block | `space.semantic.inset-sm` |
| `input` | field padding inline-start | `space.semantic.inset-md` |
| `input` | field padding inline-end | `space.semantic.inset-sm` |
| `input` | field gap | `space.semantic.gap-sm` |
| `input` | placeholder color | `color.semantic.text-subtle` |
| `input` | text color | `color.semantic.text-primary` |
| `input` | text size | `font.semantic.size-body` |
| `input` | line height | `font.semantic.line-height-body` |
| `send` | background | `color.semantic.action` |
| `send` | icon color | `color.semantic.text-on-action` |
| `send` | radius | `radius.semantic.control` |
| `stop` | background | `color.semantic.surface` |
| `stop` | border | `color.semantic.border-strong` |
| `stop` | radius | `radius.semantic.control` |
| `stop` | icon and label color | `color.semantic.text-primary` |
| `stop` | label size | `font.semantic.size-caption` |
| `stop` | label weight | `font.semantic.weight-strong` |
| `rate-limit-notice` | background | `color.semantic.surface-raised` |
| `rate-limit-notice` | border | `color.semantic.border` |
| `rate-limit-notice` | radius | `radius.semantic.control` |
| `rate-limit-notice` | min height | `chat.composer-height` |
| `rate-limit-notice` | padding block | `space.semantic.inset-sm` |
| `rate-limit-notice` | padding inline | `space.semantic.inset-md` |
| `rate-limit-notice` | gap | `space.semantic.gap-sm` |
| `rate-limit-notice` | icon and detail color | `color.semantic.text-subtle` |
| `rate-limit-notice` | title color | `color.semantic.text-primary` |
| `rate-limit-notice` | title and detail size | `font.semantic.size-caption` |
| `rate-limit-notice` | title weight | `font.semantic.weight-strong` |

## Contrast

| Foreground | Background | Minimum | Light | Dark |
| --- | --- | --- | --- | --- |
| `color.semantic.text-primary` | `color.semantic.surface` | 4.5:1 | 17.75:1 | 17.15:1 |
| `color.semantic.text-subtle` | `color.semantic.surface` | 4.5:1 | 7.69:1 | 8.17:1 |
| `color.semantic.text-subtle` | `chat.message-assistant-background` | 4.5:1 | 6.98:1 | 7.05:1 |
| `color.semantic.text-primary` | `chat.message-assistant-background` | 4.5:1 | 16.11:1 | 14.80:1 |
| `chat.message-user-text` | `chat.message-user-background` | 4.5:1 | 6.15:1 | 8.17:1 |
| `color.semantic.text-on-action` | `color.semantic.action` | 4.5:1 | 6.15:1 | 8.17:1 |
| `color.semantic.danger` | `color.semantic.danger-surface` | 4.5:1 | 6.05:1 | 8.43:1 |
| `color.semantic.text-primary` | `color.semantic.danger-surface` | 4.5:1 | 16.32:1 | 15.40:1 |
| `color.semantic.warning` | `color.semantic.warning-surface` | 4.5:1 | 5.20:1 | 8.58:1 |
| `color.semantic.text-primary` | `color.semantic.warning-surface` | 4.5:1 | 17.01:1 | 14.33:1 |
| `color.semantic.text-subtle` | `color.semantic.surface-raised` | 4.5:1 | 6.98:1 | 7.05:1 |
| `color.semantic.border-strong` | `color.semantic.surface` | 3:1 | 3.82:1 | 4.19:1 |
| `color.semantic.border-strong` | `color.semantic.danger-surface` | 3:1 | 3.51:1 | 3.76:1 |
| `color.semantic.focus` | `color.semantic.surface` | 3:1 | 6.70:1 | 10.25:1 |
| `color.semantic.action` | `color.semantic.surface` | 3:1 | 6.15:1 | 8.15:1 |

## Structure

- Root is a vertical stack: header, log, composer. It fills the host's box; the host sets size and placement.
- The log takes the remaining height and scrolls. It follows new content while scrolled to the bottom and stays put when the user has scrolled up.
- User bubbles align to the end, assistant bubbles to the start. Bubbles are at most chat.message-max-width wide and never wider than the log.
- The empty state centers in the log. Suggestions stack below it.
- An error notice spans the log width and follows the last message.
- The offline banner sits between the header and the log at full panel width. It does not scroll with the log.
- The rate-limit notice takes the place of the input and Send inside the composer's padding. It is at least chat.composer-height tall, so the log keeps its height.
- The composer field is at least chat.composer-height tall. The input grows with its content to six lines, then scrolls.
- Send and Stop occupy the same slot at the end of the field; only one renders at a time.

## Keyboard

| Keys | Where | Action |
| --- | --- | --- |
| Enter | input with text, not loading, streaming, or offline | Sends the message. |
| Shift+Enter | input | Inserts a newline. |
| Enter | input, IME composition active | Commits the composition; does not send. |
| Enter | input, loading or streaming | Does nothing; the draft stays. |
| Enter | input, offline | Does nothing; the draft stays. |
| Escape | input or Stop, loading or streaming | Stops generation. |
| Enter or Space | Stop, Retry, Send, suggestion | Activates the button. Does nothing while it is aria-disabled by offline or a rate limit. |
| Tab | anywhere | Follows DOM order: header content, log, Retry, suggestions, input, Send or Stop. |

## Focus

- After a send from the input, Send, or a suggestion, focus is in the input.
- When Stop or Retry disappears while focused, focus moves to the input.
- When the rate-limit notice replaces the input while focus is in the composer, focus moves to the notice (tabindex -1). When the input returns and focus is still on the notice, focus moves to the input.
- Controls disabled by offline or a rate limit use aria-disabled, not disabled, so they keep focus and stay in the tab order. Going offline or back online never moves focus.
- Focus is never moved otherwise: streaming, completion, and errors do not steal focus.
- The log is focusable (tabindex 0) so keyboard users can scroll it.
- The input field shows a 2px color.semantic.focus ring while the input has focus; buttons show the same ring on focus-visible.
- No focus trap and no autofocus on mount.

## Screen reader

- The root is a region named by labels.title.
- The log is a region named by labels.conversation. It is not a live region, so updates are not read twice.
- Each message starts with a visually hidden speaker name: labels.userName or labels.assistantName.
- The streaming message has aria-busy=true until it reaches a terminal state.
- One polite live region announces the thinking label, then only newly appended text at sentence ends, then the stopped label when stopped.
- Error notices use role=alert and are announced once.
- The offline banner is a role=status region, announced once when it appears. On reconnect the live region says labels.backOnline.
- The rate-limit notice is a role=status region, announced once when it appears. Its visible countdown is aria-hidden, so ticks are never announced; a visually hidden labels.rateLimitUntil gives retryAt as a clock time in the user's locale instead. When the limit lifts, the live region says labels.rateLimitLifted.
- The input has a visually hidden label from labels.input. Send's accessible name is labels.send; Stop and Retry use their visible text.
- Icons, dots, and the streaming caret are aria-hidden. Animations stop under prefers-reduced-motion: reduce.
