export const OVERFLOW_BEHAVIORS = ["infinity", "saturate", "error"] as const;

export type OverflowBehavior = (typeof OVERFLOW_BEHAVIORS)[number];
