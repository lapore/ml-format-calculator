import type { FormatId } from "../constants/format-id.js";
import type { InputMode } from "../constants/input-mode.js";
import type { NaNPolicy } from "../constants/nan-policy.js";
import type { RoundingMode } from "../constants/rounding.js";

export interface ConversionRequest {
  sourceFormatId: FormatId;
  targetFormatId: FormatId;
  inputMode: InputMode;
  inputValue: string;
  roundingMode: RoundingMode;
  nanPolicy?: NaNPolicy;
}
