import type { CalculatorMode } from "../core/constants/calculator-mode.js";
import type { InputMode } from "../core/constants/input-mode.js";
import type { NaNPolicy } from "../core/constants/nan-policy.js";
import type { CalculationRequest } from "../core/model/conversion-request.js";

export type PresetRenderState = {
  sourceFormatId: string;
  inputMode: string;
};

export function shouldRefreshPresets(
  previous: PresetRenderState | null,
  next: PresetRenderState,
): boolean {
  return (
    previous === null ||
    previous.sourceFormatId !== next.sourceFormatId ||
    previous.inputMode !== next.inputMode
  );
}

export function getCanonicalNaNUiState(
  mode: CalculatorMode,
  targetFormatId: string,
  nanPolicy: NaNPolicy,
  defaultValue: string,
): {
  visible: boolean;
  enabled: boolean;
  hint: string;
} {
  if (mode === "inspection") {
    return {
      visible: false,
      enabled: false,
      hint: "Canonical NaN applies only in conversion mode.",
    };
  }

  const hasConfigurableCanonicalNaN = defaultValue.length > 0;
  const enabled = hasConfigurableCanonicalNaN && nanPolicy === "canonical";

  if (!hasConfigurableCanonicalNaN) {
    return {
      visible: true,
      enabled: false,
      hint: "Canonical NaN applies only to target formats that define NaN encodings.",
    };
  }

  if (nanPolicy === "canonical") {
    return {
      visible: true,
      enabled: true,
      hint: `Default ${targetFormatId} canonical NaN is ${defaultValue}. You can override it with another valid NaN bit pattern.`,
    };
  }

  return {
    visible: true,
    enabled: false,
    hint: "Switch NaN policy to canonical to use a custom target NaN value.",
  };
}

export function getModeUiState(mode: CalculatorMode, inputMode: InputMode): {
  showTargetControls: boolean;
  showTargetPanel: boolean;
  showRoundingControl: boolean;
  stageHeading: string;
  stageDescription: string;
} {
  if (mode === "inspection") {
    return {
      showTargetControls: false,
      showTargetPanel: false,
      showRoundingControl: inputMode === "decimal",
      stageHeading: "Inspection Stage",
      stageDescription: "See whether the input changed while being encoded into the source format.",
    };
  }

  return {
    showTargetControls: true,
    showTargetPanel: true,
    showRoundingControl: true,
    stageHeading: "Conversion Stages",
    stageDescription: "See whether the value changed at source encoding or target conversion.",
  };
}

export function getConversionRequestKey(request: CalculationRequest): string {
  const mode = request.mode ?? "conversion";

  return JSON.stringify([
    mode,
    request.sourceFormatId,
    mode === "conversion" ? request.targetFormatId ?? "" : "",
    request.inputMode,
    request.inputValue,
    request.roundingMode,
    mode === "conversion" ? request.nanPolicy ?? "canonical" : "",
    mode === "conversion" ? request.canonicalNaNInput ?? "" : "",
  ]);
}
