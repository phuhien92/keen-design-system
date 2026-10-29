// Generated from tokens/*.json by tools/token-generator. Do not edit; run pnpm tokens:build.
// Semantic and component tokens only: primitives are not part of the typed API.
export const keenTokens = {
  color: {
    semantic: {
      action: "var(--keen-color-semantic-action)",
      border: "var(--keen-color-semantic-border)",
      "border-strong": "var(--keen-color-semantic-border-strong)",
      danger: "var(--keen-color-semantic-danger)",
      "danger-surface": "var(--keen-color-semantic-danger-surface)",
      focus: "var(--keen-color-semantic-focus)",
      surface: "var(--keen-color-semantic-surface)",
      "surface-raised": "var(--keen-color-semantic-surface-raised)",
      "text-on-action": "var(--keen-color-semantic-text-on-action)",
      "text-primary": "var(--keen-color-semantic-text-primary)",
      "text-subtle": "var(--keen-color-semantic-text-subtle)",
      warning: "var(--keen-color-semantic-warning)",
      "warning-surface": "var(--keen-color-semantic-warning-surface)",
    },
  },
  font: {
    semantic: {
      "family-body": "var(--keen-font-semantic-family-body)",
      "line-height-body": "var(--keen-font-semantic-line-height-body)",
      "size-body": "var(--keen-font-semantic-size-body)",
      "size-caption": "var(--keen-font-semantic-size-caption)",
      "size-title": "var(--keen-font-semantic-size-title)",
      "weight-strong": "var(--keen-font-semantic-weight-strong)",
    },
  },
  radius: {
    semantic: {
      container: "var(--keen-radius-semantic-container)",
      control: "var(--keen-radius-semantic-control)",
    },
  },
  space: {
    semantic: {
      "gap-sm": "var(--keen-space-semantic-gap-sm)",
      "inset-md": "var(--keen-space-semantic-inset-md)",
      "inset-sm": "var(--keen-space-semantic-inset-sm)",
    },
  },
  chat: {
    "composer-height": "var(--keen-chat-composer-height)",
    "message-assistant-background": "var(--keen-chat-message-assistant-background)",
    "message-gap": "var(--keen-chat-message-gap)",
    "message-max-width": "var(--keen-chat-message-max-width)",
    "message-radius": "var(--keen-chat-message-radius)",
    "message-user-background": "var(--keen-chat-message-user-background)",
    "message-user-text": "var(--keen-chat-message-user-text)",
  },
} as const;

export type KeenTokens = typeof keenTokens;
