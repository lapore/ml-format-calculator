import assert from "node:assert/strict";
import test from "node:test";

import type { BitSliceRequest } from "../../src/core/model/bit-slice-request.js";
import type { CalculationRequest, ConversionRequest } from "../../src/core/model/conversion-request.js";
import {
  getBitSliceRequestKey,
  getCanonicalNaNUiState,
  getConversionRequestKey,
  getModeUiState,
  shouldRefreshPresets,
  shouldShowNaNPolicyControls,
} from "../../src/ui/view-model.js";

test("refreshes presets on the first render", () => {
  assert.equal(
    shouldRefreshPresets(null, {
      sourceFormatId: "FP32",
      inputMode: "decimal",
      customSignature: "",
    }),
    true,
  );
});

test("does not refresh presets when only input values change", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
        customSignature: "",
      },
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
        customSignature: "",
      },
    ),
    false,
  );
});

test("refreshes presets when the source format changes", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
        customSignature: "",
      },
      {
        sourceFormatId: "BF16",
        inputMode: "hex",
        customSignature: "",
      },
    ),
    true,
  );
});

test("refreshes presets when the input mode changes", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "FP32",
        inputMode: "hex",
        customSignature: "",
      },
      {
        sourceFormatId: "FP32",
        inputMode: "binary",
        customSignature: "",
      },
    ),
    true,
  );
});

test("refreshes presets when the ExMy profile changes", () => {
  assert.equal(
    shouldRefreshPresets(
      {
        sourceFormatId: "ExMy",
        inputMode: "hex",
        customSignature: "ExMy-S1-E5-M2-I1-N1",
      },
      {
        sourceFormatId: "ExMy",
        inputMode: "hex",
        customSignature: "ExMy-S0-E5-M2-I1-N1",
      },
    ),
    true,
  );
});

test("enables canonical NaN controls for float targets in canonical mode", () => {
  const state = getCanonicalNaNUiState("conversion", "FP32", "BF16", "canonical", "0x7fc0");

  assert.equal(state.visible, true);
  assert.equal(state.enabled, true);
  assert.match(state.hint, /Default BF16 canonical NaN is 0x7fc0/);
});

test("disables canonical NaN controls in preserve mode", () => {
  const state = getCanonicalNaNUiState("conversion", "FP32", "FP16", "preserve", "0x7e00");

  assert.equal(state.visible, true);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /Switch NaN policy to canonical/);
});

test("disables canonical NaN controls for integer targets", () => {
  const state = getCanonicalNaNUiState("conversion", "FP32", "INT32", "canonical", "");

  assert.equal(state.visible, false);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /both source and target formats define NaN encodings/);
});

test("disables canonical NaN controls when the source format cannot encode NaN", () => {
  const state = getCanonicalNaNUiState("conversion", "INT32", "FP16", "canonical", "0x7e00");

  assert.equal(state.visible, false);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /both source and target formats define NaN encodings/);
});

test("hides canonical NaN controls in inspection mode", () => {
  const state = getCanonicalNaNUiState("inspection", "FP32", "BF16", "canonical", "0x7fc0");

  assert.equal(state.visible, false);
  assert.equal(state.enabled, false);
  assert.match(state.hint, /only in conversion mode/i);
});

test("NaN policy controls only appear when both source and target define NaN encodings", () => {
  assert.equal(shouldShowNaNPolicyControls("conversion", "FP32", "BF16"), true);
  assert.equal(shouldShowNaNPolicyControls("conversion", "INT32", "BF16"), false);
  assert.equal(shouldShowNaNPolicyControls("conversion", "FP32", "INT32"), false);
  assert.equal(shouldShowNaNPolicyControls("inspection", "FP32", "BF16"), false);
});

test("inspection mode hides target controls and keeps rounding only for decimal input", () => {
  const decimalState = getModeUiState("inspection", "decimal");
  const hexState = getModeUiState("inspection", "hex");

  assert.equal(decimalState.showTargetControls, false);
  assert.equal(decimalState.showTargetPanel, false);
  assert.equal(decimalState.showRoundingControl, true);
  assert.match(decimalState.stageHeading, /Inspection Stage/);
  assert.equal(hexState.showRoundingControl, false);
});

test("conversion mode keeps target controls visible", () => {
  const state = getModeUiState("conversion", "binary");

  assert.equal(state.showTargetControls, true);
  assert.equal(state.showTargetPanel, true);
  assert.equal(state.showRoundingControl, true);
  assert.match(state.stageHeading, /Conversion Stages/);
});

test("conversion request key stays stable for identical requests", () => {
  const request: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  assert.equal(getConversionRequestKey(request), getConversionRequestKey(request));
});

test("conversion request key changes when the effective input changes", () => {
  const baseRequest: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  const changedRequest = {
    ...baseRequest,
    inputValue: "0x7fa00000",
  };

  assert.notEqual(getConversionRequestKey(baseRequest), getConversionRequestKey(changedRequest));
});

test("conversion request key changes when canonical NaN override changes", () => {
  const baseRequest: ConversionRequest = {
    mode: "conversion",
    sourceFormatId: "FP32",
    targetFormatId: "BF16",
    inputMode: "hex",
    inputValue: "0x7fc00000",
    roundingMode: "RNE",
    nanPolicy: "canonical",
    canonicalNaNInput: "0x7fc0",
  };

  const changedRequest = {
    ...baseRequest,
    canonicalNaNInput: "0x7f81",
  };

  assert.notEqual(getConversionRequestKey(baseRequest), getConversionRequestKey(changedRequest));
});

test("request key changes when mode changes", () => {
  const inspectionRequest: CalculationRequest = {
    mode: "inspection",
    sourceFormatId: "FP32",
    inputMode: "decimal",
    inputValue: "6.5",
    roundingMode: "RNE",
  };

  const conversionRequest: ConversionRequest = {
    ...inspectionRequest,
    mode: "conversion",
    targetFormatId: "FP16",
  };

  assert.notEqual(getConversionRequestKey(inspectionRequest), getConversionRequestKey(conversionRequest));
});

test("request key changes when the ExMy inspection profile changes", () => {
  const baseRequest: CalculationRequest = {
    mode: "inspection",
    sourceFormatId: "ExMy",
    customFormatSpec: {
      hasSignBit: true,
      exponentBitCount: 5,
      mantissaBitCount: 2,
      supportsInfinity: true,
      supportsNaN: true,
    },
    inputMode: "hex",
    inputValue: "0x7d",
    roundingMode: "RNE",
  };

  const changedRequest: CalculationRequest = {
    ...baseRequest,
    customFormatSpec: {
      ...baseRequest.customFormatSpec,
      hasSignBit: false,
    },
  };

  assert.notEqual(getConversionRequestKey(baseRequest), getConversionRequestKey(changedRequest));
});

test("bit slice request key stays stable for identical requests", () => {
  const request: BitSliceRequest = {
    inputMode: "binary",
    inputValue: "0b1010_1010",
    minBit: 0,
    maxBit: 3,
  };

  assert.equal(getBitSliceRequestKey(request), getBitSliceRequestKey(request));
});

test("bit slice request key changes when the selected range changes", () => {
  const baseRequest: BitSliceRequest = {
    inputMode: "hex",
    inputValue: "0xabcd",
    minBit: 0,
    maxBit: 3,
  };

  const changedRequest: BitSliceRequest = {
    ...baseRequest,
    maxBit: 7,
  };

  assert.notEqual(getBitSliceRequestKey(baseRequest), getBitSliceRequestKey(changedRequest));
});
