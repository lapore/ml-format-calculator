import type { BitSliceInputMode } from "../constants/bit-slice-input-mode.js";

export interface BitSliceResponse {
  inputMode: BitSliceInputMode;
  inputBitWidth: number;
  normalizedInputBinary: string;
  normalizedInputHex: string;
  minBit: number;
  maxBit: number;
  sliceBitWidth: number;
  sliceBinary: string;
  sliceHex: string;
  sliceDecimal: string;
  rangeLabel: string;
  zeroPadBitCount: number;
}
