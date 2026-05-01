import type { BitSliceInputMode } from "../constants/bit-slice-input-mode.js";

export interface BitSliceRequest {
  inputMode: BitSliceInputMode;
  inputValue: string;
  minBit: number;
  maxBit: number;
}
