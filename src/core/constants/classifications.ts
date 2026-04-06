export const CLASSIFICATIONS = [
  "ZERO",
  "SUBNORMAL",
  "NORMAL",
  "INF",
  "NAN",
  "INTEGER",
  "SATURATED",
  "UNREPRESENTABLE",
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];
