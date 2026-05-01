import { type BitSliceInputMode } from "../core/constants/bit-slice-input-mode.js";

export const DEFAULT_BIT_SLICE_INPUT_MODE: BitSliceInputMode = "binary";
export const DEFAULT_BIT_SLICE_INPUT_VALUE = "0b1010_1010";
export const DEFAULT_BIT_SLICE_MIN_BIT = 0;
export const DEFAULT_BIT_SLICE_MAX_BIT = 3;

export function getBitSliceInputHint(inputMode: BitSliceInputMode): string {
  if (inputMode === "binary") {
    return "Enter binary bits. Optional 0b prefix and _ separators are ignored. Bit 0 is the LSB, and ranges are inclusive.";
  }

  return "Enter hex digits. Optional 0x prefix and _ separators are ignored. Bit 0 is the LSB, and ranges are inclusive.";
}
