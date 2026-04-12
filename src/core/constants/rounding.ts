export const ROUNDING_MODES = ["RNE", "RTZ", "RTP"] as const;

export type RoundingMode = (typeof ROUNDING_MODES)[number];
