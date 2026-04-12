import type { CalculatorMode } from "../constants/calculator-mode.js";
import type { FormatId } from "../constants/format-id.js";
import type { InputMode } from "../constants/input-mode.js";
import type { NaNPolicy } from "../constants/nan-policy.js";
import type { RoundingMode } from "../constants/rounding.js";

interface BaseRequest {
  sourceFormatId: FormatId;
  inputMode: InputMode;
  inputValue: string;
  roundingMode: RoundingMode;
}

export interface ConversionRequest extends BaseRequest {
  mode?: Extract<CalculatorMode, "conversion">;
  targetFormatId: FormatId;
  nanPolicy?: NaNPolicy;
  canonicalNaNInput?: string;
}

export interface InspectionRequest extends BaseRequest {
  mode: Extract<CalculatorMode, "inspection">;
  targetFormatId?: never;
  nanPolicy?: never;
  canonicalNaNInput?: never;
}

export type CalculationRequest = ConversionRequest | InspectionRequest;
