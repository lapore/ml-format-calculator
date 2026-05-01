import type { CalculatorMode } from "../core/constants/calculator-mode.js";
import { CUSTOM_FLOAT_FORMAT_ID, type FormatId } from "../core/constants/format-id.js";
import type { InputMode } from "../core/constants/input-mode.js";
import type { BitSliceRequest } from "../core/model/bit-slice-request.js";
import { getDefaultCanonicalNaNHex } from "../core/constants/nan-policy.js";
import type { NaNPolicy } from "../core/constants/nan-policy.js";
import type { CalculationRequest } from "../core/model/conversion-request.js";

export type PresetRenderState = {
  sourceFormatId: string;
  inputMode: string;
  customSignature: string;
};

function formatSupportsNaNEncoding(formatId: string): boolean {
  if (formatId === CUSTOM_FLOAT_FORMAT_ID) {
    return false;
  }

  return getDefaultCanonicalNaNHex(formatId as FormatId) !== null;
}

export function shouldRefreshPresets(
  previous: PresetRenderState | null,
  next: PresetRenderState,
): boolean {
  return (
    previous === null ||
    previous.sourceFormatId !== next.sourceFormatId ||
    previous.inputMode !== next.inputMode ||
    previous.customSignature !== next.customSignature
  );
}

export function getCanonicalNaNUiState(
  mode: CalculatorMode,
  sourceFormatId: string,
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

  if (!shouldShowNaNPolicyControls(mode, sourceFormatId, targetFormatId)) {
    return {
      visible: false,
      enabled: false,
      hint: "Canonical NaN applies only when both source and target formats define NaN encodings.",
    };
  }

  const hasConfigurableCanonicalNaN = defaultValue.length > 0;
  const enabled = hasConfigurableCanonicalNaN && nanPolicy === "canonical";

  if (!hasConfigurableCanonicalNaN) {
    return {
      visible: false,
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

export function shouldShowNaNPolicyControls(
  mode: CalculatorMode,
  sourceFormatId: string,
  targetFormatId: string,
): boolean {
  return (
    mode === "conversion" &&
    formatSupportsNaNEncoding(sourceFormatId) &&
    formatSupportsNaNEncoding(targetFormatId)
  );
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
    request.sourceFormatId === CUSTOM_FLOAT_FORMAT_ID ? request.customFormatSpec ?? null : null,
    mode === "conversion" ? request.targetFormatId ?? "" : "",
    request.inputMode,
    request.inputValue,
    request.roundingMode,
    mode === "conversion" ? request.nanPolicy ?? "canonical" : "",
    mode === "conversion" ? request.canonicalNaNInput ?? "" : "",
  ]);
}

export function getBitSliceRequestKey(request: BitSliceRequest): string {
  return JSON.stringify([
    request.inputMode,
    request.inputValue,
    request.minBit,
    request.maxBit,
  ]);
}
