// Generated from the icon nodes in design/keen.pen by tools/token-generator. Do not edit; add an icon in the design
// and run pnpm tokens:build. This is the only module that imports from Lucide.
import { ArrowUp, CircleAlert, Clock4, RotateCcw, Sparkles, Square, WifiOff } from "lucide-react";

export const iconRegistry = {
  "arrow-up": ArrowUp,
  "circle-alert": CircleAlert,
  "clock-4": Clock4,
  "rotate-ccw": RotateCcw,
  "sparkles": Sparkles,
  "square": Square,
  "wifi-off": WifiOff,
} as const;

export type IconName = keyof typeof iconRegistry;
