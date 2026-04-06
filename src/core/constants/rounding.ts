export const ROUNDING_MODES = ["RNE", "RTZ"] as const;

export type RoundingMode = (typeof ROUNDING_MODES)[number];
