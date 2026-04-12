import type { FormatId } from "./format-id.js";

export const NAN_POLICIES = ["preserve", "canonical"] as const;

export type NaNPolicy = (typeof NAN_POLICIES)[number];

export const DEFAULT_CANONICAL_NAN_HEX: Partial<Record<FormatId, string>> = {
  FP32: "0x7fc00000",
  BF16: "0x7fc0",
  FP16: "0x7e00",
  E5M2: "0x7d",
  E4M3: "0x7f",
};

export function getDefaultCanonicalNaNHex(formatId: FormatId): string | null {
  return DEFAULT_CANONICAL_NAN_HEX[formatId] ?? null;
}
