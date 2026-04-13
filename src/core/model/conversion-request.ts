import type { CalculatorMode } from "../constants/calculator-mode.js";
import type { CustomFloatFormatId, FormatId } from "../constants/format-id.js";
import type { InputMode } from "../constants/input-mode.js";
import type { NaNPolicy } from "../constants/nan-policy.js";
import type { RoundingMode } from "../constants/rounding.js";
import type { CustomFloatSpec } from "./custom-float-spec.js";

interface RequestBase {
  inputMode: InputMode;
  inputValue: string;
  roundingMode: RoundingMode;
}

interface FixedSourceRequestBase extends RequestBase {
  sourceFormatId: FormatId;
  customFormatSpec?: never;
}

interface CustomSourceInspectionRequestBase extends RequestBase {
  sourceFormatId: CustomFloatFormatId;
  customFormatSpec: CustomFloatSpec;
}

export interface ConversionRequest extends FixedSourceRequestBase {
  mode?: Extract<CalculatorMode, "conversion">;
  targetFormatId: FormatId;
  nanPolicy?: NaNPolicy;
  canonicalNaNInput?: string;
}

export interface FixedFormatInspectionRequest extends FixedSourceRequestBase {
  mode: Extract<CalculatorMode, "inspection">;
  targetFormatId?: never;
  nanPolicy?: never;
  canonicalNaNInput?: never;
}

export interface CustomFormatInspectionRequest extends CustomSourceInspectionRequestBase {
  mode: Extract<CalculatorMode, "inspection">;
  targetFormatId?: never;
  nanPolicy?: never;
  canonicalNaNInput?: never;
}

export type InspectionRequest = FixedFormatInspectionRequest | CustomFormatInspectionRequest;
export type CalculationRequest = ConversionRequest | InspectionRequest;
