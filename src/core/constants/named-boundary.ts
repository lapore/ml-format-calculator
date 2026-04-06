export const NAMED_BOUNDARIES = [
  "MIN_SUBNORMAL",
  "MAX_SUBNORMAL",
  "MIN_NORMAL",
  "MAX_NORMAL",
  "MIN_VALUE",
  "MAX_VALUE",
] as const;

export type NamedBoundary = (typeof NAMED_BOUNDARIES)[number];
