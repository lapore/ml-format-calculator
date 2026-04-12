import type { CalculatorMode } from "../constants/calculator-mode.js";
import type { DecodedValue } from "./decoded-value.js";
import type { EncodedValue } from "./encoded-value.js";

export interface ConversionStageReport {
  stage: "input-to-source" | "source-to-target";
  applied: boolean;
  roundingModeApplied: boolean;
  valueChanged: boolean;
  summary: string;
}

interface BaseResponse {
  mode: CalculatorMode;
  source: DecodedValue;
  encodedSource?: EncodedValue;
  stages: ConversionStageReport[];
  warnings: string[];
  notes: string[];
}

export interface ConversionModeResponse extends BaseResponse {
  mode: "conversion";
  target: DecodedValue;
  encodedTarget: EncodedValue | null;
  targetError?: string | null;
}

export interface InspectionResponse extends BaseResponse {
  mode: "inspection";
  target: null;
  encodedTarget: null;
  targetError: null;
}

export type ConversionResponse = ConversionModeResponse | InspectionResponse;
