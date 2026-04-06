import type { FormatId } from "../constants/format-id.js";
import type { RoundingMode } from "../constants/rounding.js";

export interface EncodedValue {
  formatId: FormatId;
  inputValue: number;
  roundingMode: RoundingMode;
  rawBits: bigint;
  rawBinary: string;
  rawHex: string;
  notes: string[];
}
