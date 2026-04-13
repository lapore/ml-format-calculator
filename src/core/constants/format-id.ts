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

export const CUSTOM_FLOAT_FORMAT_ID = "ExMy" as const;

export type CustomFloatFormatId = typeof CUSTOM_FLOAT_FORMAT_ID;
export type AnyFormatId = FormatId | CustomFloatFormatId;
export type SourceFormatId = AnyFormatId;
