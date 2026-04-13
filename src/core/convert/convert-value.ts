import type { CalculationRequest, ConversionRequest, InspectionRequest } from "../model/conversion-request.js";
import type {
  ConversionModeResponse,
  ConversionResponse,
  ConversionStageReport,
  InspectionResponse,
} from "../model/conversion-response.js";
import type { CalculatorMode } from "../constants/calculator-mode.js";
import { CUSTOM_FLOAT_FORMAT_ID } from "../constants/format-id.js";
import { getDefaultCanonicalNaNHex } from "../constants/nan-policy.js";
import type { NaNPolicy } from "../constants/nan-policy.js";
import { decodeBitsForFormat } from "../decode/index.js";
import type { FormatDefinition } from "../model/format-definition.js";
import type { DecodedValue } from "../model/decoded-value.js";
import type { EncodedValue } from "../model/encoded-value.js";
import { encodeValueForFormat } from "../encode/index.js";
import { createCustomFloatFormat } from "../formats/custom-exmy.js";
import { getFormatDefinition } from "../formats/index.js";
import { parseBinaryInput } from "../parse/parse-binary.js";
import { parseDecimalInput } from "../parse/parse-decimal.js";
import { parseHexInput } from "../parse/parse-hex.js";

function getRequestMode(request: CalculationRequest): CalculatorMode {
  return request.mode ?? "conversion";
}

function isConversionRequest(request: CalculationRequest): request is ConversionRequest {
  return getRequestMode(request) === "conversion";
}

function getTargetFormatDefinition(request: ConversionRequest): FormatDefinition {
  if (!request.targetFormatId) {
    throw new Error("Conversion mode requires a target format");
  }

  return getFormatDefinition(request.targetFormatId);
}

function getSourceFormatDefinition(request: CalculationRequest): FormatDefinition {
  if (request.sourceFormatId === CUSTOM_FLOAT_FORMAT_ID) {
    if (request.mode !== "inspection" || !request.customFormatSpec) {
      throw new Error("Custom ExMy source format requires an inspection-mode custom format spec");
    }

    return createCustomFloatFormat(request.customFormatSpec);
  }

  return getFormatDefinition(request.sourceFormatId);
}

function decodeSourceInput(request: CalculationRequest, sourceFormat: FormatDefinition) {

  if (request.inputMode === "decimal") {
    return null;
  }

  if (request.inputMode === "binary") {
    return parseBinaryInput(request.inputValue, sourceFormat.bitWidth);
  }

  if (request.inputMode === "hex") {
    return parseHexInput(request.inputValue, sourceFormat.bitWidth);
  }

  throw new Error(`Unsupported input mode: ${request.inputMode satisfies never}`);
}

function valuesEqual(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return false;
  }

  if (Number.isNaN(left) && Number.isNaN(right)) {
    return true;
  }

  return Object.is(left, right);
}

function formatStageValue(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (Object.is(value, -0)) {
    return "-0";
  }

  if (value === Number.POSITIVE_INFINITY) {
    return "+inf";
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return "-inf";
  }

  return String(value);
}

function hasEquivalentNaNRepresentation(left: DecodedValue, right: DecodedValue): boolean {
  return (
    left.isNaN &&
    right.isNaN &&
    left.sign === right.sign &&
    left.nanKind === right.nanKind &&
    left.mantissaBits === right.mantissaBits
  );
}

function targetValuePreserved(source: DecodedValue, target: DecodedValue): boolean {
  if (source.isNaN || target.isNaN) {
    return hasEquivalentNaNRepresentation(source, target);
  }

  return valuesEqual(source.decimalValue, target.decimalValue);
}

function formatSupportsNaNEncoding(format: FormatDefinition): boolean {
  if (format.id === CUSTOM_FLOAT_FORMAT_ID) {
    return false;
  }

  return getDefaultCanonicalNaNHex(format.id) !== null;
}

function summarizeStage(
  stage: ConversionStageReport["stage"],
  applied: boolean,
  valueChanged: boolean,
  fromValue: number | null,
  toValue: number | null,
  roundingMode: ConversionRequest["roundingMode"],
  roundingModeApplied = true,
  changeDetail?: string,
): ConversionStageReport {
  const label = stage === "input-to-source" ? "Input -> source" : "Source -> target";

  if (!applied) {
    return {
      stage,
      applied,
      roundingModeApplied: false,
      valueChanged: false,
      summary: `${label}: exact decode, no rounding step applied.`,
    };
  }

  if (fromValue === null || toValue === null) {
    return {
      stage,
      applied,
        roundingModeApplied,
        valueChanged,
        summary: roundingModeApplied
        ? `${label}: conversion applied with ${roundingMode}.`
        : `${label}: conversion applied without numeric rounding.`,
    };
  }

  if (!roundingModeApplied) {
    return {
      stage,
      applied,
      roundingModeApplied: false,
      valueChanged,
      summary: valueChanged
        ? changeDetail
          ? `${label}: ${changeDetail} without numeric rounding.`
          : `${label}: value changed from ${formatStageValue(fromValue)} to ${formatStageValue(toValue)} without numeric rounding.`
        : `${label}: special value preserved without numeric rounding.`,
    };
  }

  if (valueChanged) {
    return {
      stage,
      applied,
      roundingModeApplied: true,
      valueChanged,
      summary: changeDetail
        ? `${label}: ${changeDetail} using ${roundingMode}.`
        : `${label}: value changed from ${formatStageValue(fromValue)} to ${formatStageValue(toValue)} using ${roundingMode}.`,
    };
  }

  return {
    stage,
    applied,
    roundingModeApplied: true,
    valueChanged: false,
    summary: `${label}: ${roundingMode} applied, but the representable value stayed the same.`,
  };
}

function createEncodedFromDecoded(
  decoded: DecodedValue,
  roundingMode: ConversionRequest["roundingMode"],
  note: string,
): EncodedValue {
  return {
    formatId: decoded.formatId,
    inputValue: decoded.decimalValue ?? Number.NaN,
    roundingMode,
    rawBits: decoded.rawBits,
    rawBinary: decoded.rawBinary,
    rawHex: decoded.rawHex,
    notes: [note],
  };
}

function createUnrepresentableTarget(
  format: FormatDefinition,
  message: string,
): DecodedValue {
  return {
    formatId: format.id,
    rawBits: 0n,
    rawBinary: "",
    rawHex: "",
    classification: "UNREPRESENTABLE",
    sign: "NONE",
    signBit: null,
    exponentBits: null,
    mantissaBits: null,
    exponentBias: format.exponentBias,
    storedBiasedExponent: null,
    actualExponent: null,
    decimalValue: null,
    decimalValueText: message,
    isZero: false,
    isSubnormal: false,
    isNormal: false,
    isInfinity: false,
    isNaN: false,
    nanKind: null,
  };
}

function buildTargetNaNMantissaBits(
  targetFormat: FormatDefinition,
  targetMantissaBitCount: number,
  source: DecodedValue,
): string {
  if (targetFormat.id === "UE8M0") {
    return "";
  }

  if (targetMantissaBitCount <= 0) {
    throw new Error("Target float format must have mantissa bits for NaN encoding");
  }

  if (targetFormat.id === "E4M3") {
    return "111";
  }

  const sourceMantissaBits = source.mantissaBits ?? "";

  if (targetFormat.id === "E5M2") {
    const payloadBits = sourceMantissaBits.slice(0, targetMantissaBitCount).padEnd(targetMantissaBitCount, "0");
    return /^0+$/.test(payloadBits) ? "01" : payloadBits;
  }

  const sourcePayloadBits = sourceMantissaBits.length > 0 ? sourceMantissaBits.slice(1) : "";
  const quietBit = source.nanKind === "signaling" ? "0" : "1";
  const payloadLength = targetMantissaBitCount - 1;
  let payloadBits = sourcePayloadBits.slice(0, payloadLength).padEnd(payloadLength, "0");
  let combined = `${quietBit}${payloadBits}`;

  if (/^0+$/.test(combined)) {
    payloadBits =
      payloadLength === 0
        ? ""
        : `${payloadBits.slice(0, Math.max(0, payloadLength - 1))}1`;
    combined = `${quietBit}${payloadBits}`;
  }

  return combined;
}

function getCanonicalNaNRawBits(
  targetFormat: FormatDefinition,
  canonicalNaNInput?: string,
): bigint {
  const rawInput = canonicalNaNInput?.trim();
  const defaultCanonicalNaNHex = getDefaultCanonicalNaNHex(targetFormat.id);

  if (!defaultCanonicalNaNHex) {
    throw new Error(`${targetFormat.id}: canonical NaN encoding is not defined`);
  }

  const rawBits =
    rawInput && rawInput.length > 0
      ? parseHexInput(rawInput, targetFormat.bitWidth)
      : parseHexInput(defaultCanonicalNaNHex, targetFormat.bitWidth);

  const decoded = decodeBitsForFormat(targetFormat, rawBits);
  if (!decoded.isNaN) {
    throw new Error(`${targetFormat.id}: canonical NaN value must decode to NaN`);
  }

  return rawBits;
}

function encodeFloatSpecialFromSource(
  targetFormat: FormatDefinition,
  source: DecodedValue,
  roundingMode: ConversionRequest["roundingMode"],
  nanPolicy: NaNPolicy,
  canonicalNaNInput?: string,
): EncodedValue {
  if (targetFormat.kind === "integer") {
    throw new Error(`${targetFormat.id}: integer target cannot use float special encoding`);
  }

  const signField =
    targetFormat.hasSignBit && source.sign === "NEG"
      ? 1n << BigInt(targetFormat.exponentBitCount + targetFormat.mantissaBitCount)
      : 0n;
  const exponentAllOnes =
    ((1n << BigInt(targetFormat.exponentBitCount)) - 1n) << BigInt(targetFormat.mantissaBitCount);

  let rawBits = signField;
  let note = "Special value preserved during conversion.";

  if (source.isInfinity) {
    if (targetFormat.supportsInfinity && targetFormat.overflowBehavior === "infinity") {
      rawBits |= exponentAllOnes;
      note = "Infinity preserved during conversion.";
    } else if (targetFormat.overflowBehavior === "saturate") {
      const saturated = encodeValueForFormat(
        targetFormat,
        source.sign === "NEG" && targetFormat.hasSignBit ? -Number.MAX_VALUE : Number.MAX_VALUE,
        roundingMode,
      );
      rawBits = saturated.rawBits;
      note = "Infinity saturated to the maximum finite target value during conversion.";
    } else {
      throw new Error(`${targetFormat.id}: infinity is not representable in this format`);
    }
  } else if (source.isNaN) {
    if (!targetFormat.supportsNaN) {
      throw new Error(`${targetFormat.id}: NaN is not representable in this format`);
    }

    if (nanPolicy === "canonical") {
      rawBits = getCanonicalNaNRawBits(targetFormat, canonicalNaNInput);
      note = canonicalNaNInput?.trim()
        ? `NaN canonicalized during conversion using custom target value ${`0x${rawBits.toString(16).padStart(Math.ceil(targetFormat.bitWidth / 4), "0")}`}.`
        : "NaN canonicalized during conversion.";
    } else {
      const mantissaBits = buildTargetNaNMantissaBits(
        targetFormat,
        targetFormat.mantissaBitCount,
        source,
      );
      rawBits |= exponentAllOnes;
      if (mantissaBits.length > 0) {
        rawBits |= BigInt(`0b${mantissaBits}`);
      }
      note =
        targetFormat.id === "E4M3" ||
        targetFormat.id === "E5M2" ||
        targetFormat.id === "UE8M0"
          ? "NaN preserved during conversion using the target's reserved NaN encoding."
          : "NaN preserved during conversion with signaling/quiet state retained when possible.";
    }
  } else if (source.isZero) {
    if (!targetFormat.supportsZero) {
      const saturated = encodeValueForFormat(targetFormat, 0, roundingMode);
      rawBits = saturated.rawBits;
      note = "Zero saturated to the minimum finite target value because the target format has no zero encoding.";
    } else if (!targetFormat.hasSignBit) {
      note =
        source.sign === "NEG"
          ? "Negative zero converted to unsigned zero because the target format has no sign bit."
          : "Zero preserved during conversion.";
    } else {
      note = "Signed zero preserved during conversion.";
    }
  }

  return {
    formatId: targetFormat.id,
    inputValue: source.decimalValue ?? Number.NaN,
    roundingMode,
    rawBits,
    rawBinary: rawBits.toString(2).padStart(targetFormat.bitWidth, "0"),
    rawHex: `0x${rawBits.toString(16).padStart(Math.ceil(targetFormat.bitWidth / 4), "0")}`,
    notes: [note],
  };
}

export function convertValue(request: InspectionRequest): InspectionResponse;
export function convertValue(request: ConversionRequest): ConversionModeResponse;
export function convertValue(request: CalculationRequest): ConversionResponse;
export function convertValue(request: CalculationRequest): ConversionResponse {
  const conversionRequest = isConversionRequest(request) ? request : null;
  const mode = conversionRequest ? "conversion" : "inspection";
  const sourceFormat = getSourceFormatDefinition(request);
  const targetFormat = conversionRequest ? getTargetFormatDefinition(conversionRequest) : null;
  const nanPolicy = conversionRequest?.nanPolicy ?? "canonical";

  let source;
  let encodedSource;
  let parsedInputDecimal: number | null = null;
  let sourceDecimalValue: number;
  let targetError: string | null = null;

    if (request.inputMode === "decimal") {
      sourceDecimalValue = parseDecimalInput(request.inputValue);
    parsedInputDecimal = sourceDecimalValue;
    encodedSource = encodeValueForFormat(
      sourceFormat,
      sourceDecimalValue,
      request.roundingMode,
    );
    source = decodeBitsForFormat(sourceFormat, encodedSource.rawBits);
    if (source.decimalValue === null) {
      throw new Error("Source format cannot produce a decimal interpretation");
    }
    sourceDecimalValue = source.decimalValue;
  } else {
    const sourceBits = decodeSourceInput(request, sourceFormat);
    if (sourceBits === null) {
      throw new Error("Expected raw source bits for non-decimal input");
    }

    source = decodeBitsForFormat(sourceFormat, sourceBits);

    if (source.decimalValue === null) {
      throw new Error("Source format cannot produce a decimal interpretation");
    }

      sourceDecimalValue = source.decimalValue;
  }

  let encodedTarget: EncodedValue | null = null;
  let target: DecodedValue;

  const stages: ConversionStageReport[] = [];

  if (request.inputMode === "decimal") {
    const sourceStageUsesRounding = !source.isNaN && !source.isInfinity;
    stages.push(
      summarizeStage(
        "input-to-source",
        true,
        !valuesEqual(parsedInputDecimal, source.decimalValue),
        parsedInputDecimal,
        source.decimalValue,
        request.roundingMode,
        sourceStageUsesRounding,
      ),
    );
  } else {
    stages.push(
      summarizeStage(
        "input-to-source",
        false,
        false,
        null,
        source.decimalValue,
        request.roundingMode,
      ),
    );
  }

  if (!conversionRequest) {
    const warnings = stages.filter((stage) => stage.valueChanged).map((stage) => stage.summary);
    const notes = [
      "Mode: inspection.",
      `Inspected ${sourceFormat.displayName} using ${request.inputMode} input.`,
      request.inputMode === "decimal"
        ? `Rounding mode: ${request.roundingMode}.`
        : "Rounding mode: not used because raw input is decoded exactly.",
      ...(encodedSource?.notes ?? []),
      ...stages.map((stage) => stage.summary),
    ];

    return {
      mode: "inspection",
      source,
      target: null,
      encodedSource,
      encodedTarget: null,
      stages,
      warnings,
      notes,
      targetError: null,
    };
  }

  if (!targetFormat) {
    throw new Error("Conversion mode requires a target format");
  }

  const canonicalizesTargetNaN =
    nanPolicy === "canonical" && targetFormat.kind !== "integer" && source.isNaN;

  if (sourceFormat.id === targetFormat.id && !canonicalizesTargetNaN) {
    encodedTarget =
      encodedSource ??
      createEncodedFromDecoded(source, request.roundingMode, "Identity conversion preserved the source bit pattern.");
    target = source;
    stages.push({
      stage: "source-to-target",
      applied: false,
      roundingModeApplied: false,
      valueChanged: false,
      summary: "Source -> target: source and target formats are identical, so the bit pattern was preserved.",
    });
  } else {
    try {
      const usesFloatSpecialPath =
        targetFormat.kind !== "integer" && (source.isNaN || source.isInfinity || source.isZero);
      if (usesFloatSpecialPath) {
        encodedTarget = encodeFloatSpecialFromSource(
          targetFormat,
          source,
          request.roundingMode,
          nanPolicy,
          conversionRequest.canonicalNaNInput,
        );
      } else {
        encodedTarget = encodeValueForFormat(
          targetFormat,
          sourceDecimalValue,
          request.roundingMode,
        );
      }

      target = decodeBitsForFormat(targetFormat, encodedTarget.rawBits);
      const targetValueChanged = !targetValuePreserved(source, target);
      const targetChangeDetail =
        source.isNaN && target.isNaN && targetValueChanged
          ? nanPolicy === "canonical"
            ? "NaN canonicalized during conversion"
            : "NaN representation changed during conversion"
          : undefined;
      stages.push(
        summarizeStage(
          "source-to-target",
          true,
          targetValueChanged,
          source.decimalValue,
          target.decimalValue,
          request.roundingMode,
          !usesFloatSpecialPath,
          targetChangeDetail,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      targetError = `${targetFormat.id} cannot represent the source value: ${message}`;
      target = createUnrepresentableTarget(targetFormat, targetError);
      stages.push({
        stage: "source-to-target",
        applied: true,
        roundingModeApplied: false,
        valueChanged: true,
        summary: `Source -> target: ${targetError}`,
      });
    }
  }

  const warnings = stages.filter((stage) => stage.valueChanged).map((stage) => stage.summary);
  const nanPolicyApplies =
    formatSupportsNaNEncoding(sourceFormat) &&
    formatSupportsNaNEncoding(targetFormat);
  const notes = [
    "Mode: conversion.",
    `Converted from ${sourceFormat.id} to ${targetFormat.id}.`,
    `Rounding mode: ${request.roundingMode}.`,
    ...(nanPolicyApplies ? [`NaN policy: ${nanPolicy}.`] : []),
    ...(encodedSource?.notes ?? []),
    ...(encodedTarget?.notes ?? []),
    ...stages.map((stage) => stage.summary),
  ];

  return {
    mode: "conversion",
    source,
    target,
    encodedSource,
    encodedTarget,
    stages,
    warnings,
    notes,
    targetError,
  };
}
