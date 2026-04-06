import type { DecodedValue } from "./decoded-value.js";
import type { EncodedValue } from "./encoded-value.js";

export interface ConversionStageReport {
  stage: "input-to-source" | "source-to-target";
  applied: boolean;
  roundingModeApplied: boolean;
  valueChanged: boolean;
  summary: string;
}

export interface ConversionResponse {
  source: DecodedValue;
  target: DecodedValue;
  encodedSource?: EncodedValue;
  encodedTarget: EncodedValue | null;
  stages: ConversionStageReport[];
  warnings: string[];
  notes: string[];
  targetError?: string | null;
}
