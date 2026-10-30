// Generated from tokens/*.json by tools/token-generator. Do not edit; run pnpm tokens:build.
// Motion durations that JavaScript timers use. schedule: when something starts or is removed; reduced motion leaves
// it alone. pace: an animation rate; the component checks reduced motion and skips the animation.
export const motionTimings = {
  "duration-base": { ms: 200, kind: "schedule" },
  "duration-fast": { ms: 150, kind: "schedule" },
  "duration-instant": { ms: 75, kind: "schedule" },
  "duration-loop": { ms: 1400, kind: "pace" },
  "duration-slow": { ms: 300, kind: "schedule" },
} as const;

export type MotionTiming = keyof typeof motionTimings;
