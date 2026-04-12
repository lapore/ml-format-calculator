export const FORMAT_IDS = [
  "FP32",
  "BF16",
  "FP16",
  "E5M2",
  "E4M3",
  "E2M1",
  "UE8M0",
  "INT32",
] as const;

export type FormatId = (typeof FORMAT_IDS)[number];
