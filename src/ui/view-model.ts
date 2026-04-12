import type { NaNPolicy } from "../core/constants/nan-policy.js";
import type { ConversionRequest } from "../core/model/conversion-request.js";

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
  targetFormatId: string,
  nanPolicy: NaNPolicy,
  defaultValue: string,
): {
  enabled: boolean;
  hint: string;
} {
  const hasConfigurableCanonicalNaN = defaultValue.length > 0;
  const enabled = hasConfigurableCanonicalNaN && nanPolicy === "canonical";

  if (!hasConfigurableCanonicalNaN) {
    return {
      enabled: false,
      hint: "Canonical NaN applies only to target formats that define NaN encodings.",
    };
  }

  if (nanPolicy === "canonical") {
    return {
      enabled: true,
      hint: `Default ${targetFormatId} canonical NaN is ${defaultValue}. You can override it with another valid NaN bit pattern.`,
    };
  }

  return {
    enabled: false,
    hint: "Switch NaN policy to canonical to use a custom target NaN value.",
  };
}

export function getConversionRequestKey(request: ConversionRequest): string {
  return JSON.stringify([
    request.sourceFormatId,
    request.targetFormatId,
    request.inputMode,
    request.inputValue,
    request.roundingMode,
    request.nanPolicy ?? "canonical",
    request.canonicalNaNInput ?? "",
  ]);
}
