export const FORMAT_IDS = [
  "FP32",
  "BF16",
  "FP16",
  "E4M3",
  "E2M1",
  "E5M2",
  "INT32",
] as const;

export type FormatId = (typeof FORMAT_IDS)[number];
