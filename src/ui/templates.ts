import type { ConversionStageReport } from "../core/model/conversion-response.js";
import type { DecodedValue } from "../core/model/decoded-value.js";
import type { BitSliceResponse } from "../core/model/bit-slice-response.js";
import { escapeHtml, getNaNRuleText } from "./rendering.js";

function renderField(label: string, value: string) {
  const escapedLabel = escapeHtml(label);
  const escapedValue = escapeHtml(value);
  return `
    <div class="field">
      <span class="field-label">${escapedLabel}</span>
      <code>${escapedValue}</code>
    </div>
  `;
}

function binaryFractionToDecimal(bits: string | null): number {
  if (!bits) {
    return 0;
  }

  let value = 0;

  for (let index = 0; index < bits.length; index += 1) {
    if (bits[index] === "1") {
      value += 2 ** -(index + 1);
    }
  }

  return value;
}

function formatNaNKindLabel(nanKind: DecodedValue["nanKind"]): string | null {
  if (nanKind === "quiet") {
    return "qNaN";
  }

  if (nanKind === "signaling") {
    return "sNaN";
  }

  return null;
}

function renderEquationBlock(decoded: Pick<
  DecodedValue,
  | "classification"
  | "sign"
  | "signBit"
  | "exponentBits"
  | "mantissaBits"
  | "exponentBias"
  | "storedBiasedExponent"
  | "actualExponent"
  | "decimalValueText"
  | "nanKind"
  | "formatId"
>) {
  const signExponent = decoded.sign === "NEG" ? "1" : "0";
  const signTerm = decoded.sign === "NEG" ? "-1" : "+1";
  const hasExplicitSign = decoded.sign !== "NONE";
  const signExplanation = hasExplicitSign
    ? `(-1)^${signExponent} = ${signTerm}`
    : "Unsigned format, so the sign is always positive.";

  if (decoded.formatId === "INT32") {
    const signRule = decoded.sign === "NEG"
      ? "Sign bit is 1, so interpret the raw bits using two's complement."
      : "Sign bit is 0, so the raw bits are already the positive integer value.";
    const escapedDecimalValue = escapeHtml(decoded.decimalValueText);
    const escapedSignBit = escapeHtml(decoded.signBit ?? "n/a");
    const escapedSign = escapeHtml(decoded.sign);
    const escapedSignRule = escapeHtml(signRule);

    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${escapedDecimalValue}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Sign bit</span><code>${escapedSignBit} -> ${escapedSign}</code></div>
          <div class="equation-line"><span>Interpretation</span><code>${escapedSignRule}</code></div>
          <div class="equation-line"><span>Result</span><code>${escapedDecimalValue}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "ZERO") {
    const escapedDecimalValue = escapeHtml(decoded.decimalValueText);
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${escapedDecimalValue}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>Exponent = 0 and mantissa = 0</code></div>
          <div class="equation-line"><span>Result</span><code>${escapedDecimalValue}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "INF") {
    const escapedDecimalValue = escapeHtml(decoded.decimalValueText);
    const escapedSignTerm = escapeHtml(signExplanation);
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${escapedDecimalValue}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>Exponent = all ones, mantissa = 0</code></div>
          <div class="equation-line"><span>Sign term</span><code>${escapedSignTerm}</code></div>
          <div class="equation-line"><span>Result</span><code>${escapedDecimalValue}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "NAN") {
    const escapedNaNLabel = escapeHtml(formatNaNKindLabel(decoded.nanKind) ?? "NaN");
    const escapedNaNRule = escapeHtml(getNaNRuleText(decoded.formatId));
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${escapedNaNLabel}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>${escapedNaNRule}</code></div>
          <div class="equation-line"><span>Kind</span><code>${escapedNaNLabel}</code></div>
        </div>
      </details>
    `;
  }

  const mantissaBits = decoded.mantissaBits ?? "";
  const fractionDecimal = binaryFractionToDecimal(mantissaBits);
  const significandPrefix = decoded.classification === "SUBNORMAL" ? "0" : "1";
  const significandValue =
    decoded.classification === "SUBNORMAL" ? fractionDecimal : 1 + fractionDecimal;
  const exponentTerm =
    decoded.classification === "SUBNORMAL"
      ? `2^(1 - ${decoded.exponentBias})`
      : `2^${decoded.actualExponent}`;
  const exponentValue =
    decoded.classification === "SUBNORMAL"
      ? decoded.exponentBias === null
        ? "n/a"
        : String(1 - decoded.exponentBias)
      : String(decoded.actualExponent);
  const exponentDerivation =
    decoded.classification === "SUBNORMAL"
      ? `1 - ${decoded.exponentBias} = ${exponentValue}`
      : `${decoded.storedBiasedExponent} - ${decoded.exponentBias} = ${exponentValue}`;
  const escapedEquation = escapeHtml(
    hasExplicitSign
      ? `value = (-1)^${signExponent} × ${significandPrefix}.${mantissaBits || "0"} × ${exponentTerm}`
      : `value = ${significandPrefix}.${mantissaBits || "0"} × ${exponentTerm}`,
  );
  const escapedSignTerm = escapeHtml(signExplanation);
  const escapedStoredExponent = escapeHtml(String(decoded.storedBiasedExponent ?? "n/a"));
  const escapedBias = escapeHtml(String(decoded.exponentBias ?? "n/a"));
  const escapedActualExponent = escapeHtml(exponentDerivation);
  const escapedMantissaBits = escapeHtml(mantissaBits || "0");
  const escapedSignificand = escapeHtml(
    `${significandPrefix}.${mantissaBits || "0"} = ${significandValue}`,
  );
  const escapedDecimalValue = escapeHtml(decoded.decimalValueText);

  return `
    <details class="equation-block">
      <summary class="equation-summary">
        <span class="field-label">Equation</span>
        <code>${escapedEquation}</code>
      </summary>
      <div class="equation-details">
        <div class="equation-line"><span>Sign term</span><code>${escapedSignTerm}</code></div>
        <div class="equation-line"><span>Stored exponent</span><code>${escapedStoredExponent}</code></div>
        <div class="equation-line"><span>Bias</span><code>${escapedBias}</code></div>
        <div class="equation-line"><span>Actual exponent</span><code>${escapedActualExponent}</code></div>
        <div class="equation-line"><span>Mantissa bits</span><code>${escapedMantissaBits}</code></div>
        <div class="equation-line"><span>Significand</span><code>${escapedSignificand}</code></div>
        <div class="equation-line"><span>Final value</span><code>${escapedDecimalValue}</code></div>
      </div>
    </details>
  `;
}

function renderBitGroups(decoded: Pick<DecodedValue, "rawBinary" | "signBit" | "exponentBits" | "mantissaBits">) {
  const hasStructuredBits =
    decoded.signBit !== null || decoded.exponentBits !== null || decoded.mantissaBits !== null;

  if (!hasStructuredBits) {
    return renderField("Binary", decoded.rawBinary);
  }

  const signChunk = decoded.signBit
    ? `<span class="bit-chunk sign">${escapeHtml(decoded.signBit)}</span>`
    : "";
  const exponentChunk = decoded.exponentBits
    ? `<span class="bit-chunk exponent">${escapeHtml(decoded.exponentBits)}</span>`
    : "";
  const mantissaChunk = decoded.mantissaBits
    ? `<span class="bit-chunk mantissa">${escapeHtml(decoded.mantissaBits)}</span>`
    : "";
  const escapedRawBinary = escapeHtml(decoded.rawBinary);

  return `
    <div class="field">
      <span class="field-label">Binary</span>
      <div class="bit-groups">
        ${signChunk}
        ${exponentChunk}
        ${mantissaChunk}
      </div>
      <div class="bit-legend">
        ${decoded.signBit ? `<span><i class="legend-dot sign"></i>Sign</span>` : ""}
        ${decoded.exponentBits ? `<span><i class="legend-dot exponent"></i>Exponent</span>` : ""}
        ${decoded.mantissaBits ? `<span><i class="legend-dot mantissa"></i>Mantissa</span>` : ""}
      </div>
      <code class="bit-raw">${escapedRawBinary}</code>
    </div>
  `;
}

export function renderStage(stage: ConversionStageReport) {
  const title = stage.stage === "input-to-source" ? "Input -> Source" : "Source -> Target";
  const valueStatus = stage.valueChanged ? "Value changed" : "Value preserved";
  const modeStatus = !stage.applied
    ? "exact decode"
    : stage.roundingModeApplied
      ? "rounding used"
      : "no numeric rounding";
  const escapedTitle = escapeHtml(title);
  const escapedValueStatus = escapeHtml(valueStatus);
  const escapedModeStatus = escapeHtml(modeStatus);
  const escapedSummary = escapeHtml(stage.summary);

  return `
    <article class="stage-card ${stage.valueChanged ? "changed" : "stable"}">
      <div class="stage-top">
        <div>
          <p class="stage-label">${escapedTitle}</p>
          <strong>${escapedValueStatus}</strong>
        </div>
        <div class="stage-badges">
          <span class="badge ${stage.valueChanged ? "alert" : "subtle"}">${escapedValueStatus}</span>
          <span class="badge subtle">${escapedModeStatus}</span>
        </div>
      </div>
      <p class="stage-summary">${escapedSummary}</p>
    </article>
  `;
}

export function renderPanel(decoded: Pick<
  DecodedValue,
  | "formatId"
  | "classification"
  | "sign"
  | "rawBinary"
  | "rawHex"
  | "decimalValueText"
  | "signBit"
  | "exponentBits"
  | "mantissaBits"
  | "exponentBias"
  | "storedBiasedExponent"
  | "actualExponent"
  | "nanKind"
>) {
  const escapedClassification = escapeHtml(decoded.classification);
  const escapedSign = escapeHtml(decoded.sign);
  const escapedNaNKind = formatNaNKindLabel(decoded.nanKind)
    ? escapeHtml(formatNaNKindLabel(decoded.nanKind) ?? "")
    : null;

  return `
    <div class="stat-row">
      <div class="badge">${escapedClassification}</div>
      <div class="badge subtle">sign: ${escapedSign}</div>
      ${escapedNaNKind ? `<div class="badge subtle">${escapedNaNKind}</div>` : ""}
    </div>
    ${renderField("Decimal", decoded.decimalValueText)}
    ${renderField("Hex", decoded.rawHex)}
    ${renderBitGroups(decoded)}
    ${renderField("Sign bit", decoded.signBit ?? "n/a")}
    ${renderField("Exponent bits", decoded.exponentBits ?? "n/a")}
    ${renderField("Mantissa bits", decoded.mantissaBits ?? "n/a")}
    ${renderField("Bias", decoded.exponentBias === null ? "n/a" : String(decoded.exponentBias))}
    ${renderField(
      "Stored exponent",
      decoded.storedBiasedExponent === null ? "n/a" : String(decoded.storedBiasedExponent),
    )}
    ${renderField(
      "Actual exponent",
      decoded.actualExponent === null ? "n/a" : String(decoded.actualExponent),
    )}
    ${renderEquationBlock(decoded)}
  `;
}

export function renderStatusMessage(kind: "error" | "muted", message: string): string {
  return `<p class="${kind}">${escapeHtml(message)}</p>`;
}

export function renderBitSlicePanel(result: BitSliceResponse): string {
  const zeroPaddingMessage = result.zeroPadBitCount > 0
    ? `Zero-padded above the input width by ${result.zeroPadBitCount} bit${result.zeroPadBitCount === 1 ? "" : "s"}.`
    : "No zero-padding was needed.";

  return `
    <div class="stat-row">
      <div class="badge">Bit Slice</div>
      <div class="badge subtle">${escapeHtml(result.rangeLabel)}</div>
      <div class="badge subtle">${escapeHtml(`${result.sliceBitWidth} bits`)}</div>
    </div>
    ${renderField("Normalized input (binary)", result.normalizedInputBinary)}
    ${renderField("Normalized input (hex)", result.normalizedInputHex)}
    ${renderField("Input width", `${result.inputBitWidth} bits`)}
    ${renderField("Range", result.rangeLabel)}
    ${renderField("Slice width", `${result.sliceBitWidth} bits`)}
    ${renderField("Binary", result.sliceBinary)}
    ${renderField("Hex", result.sliceHex)}
    ${renderField("Decimal", result.sliceDecimal)}
    ${renderField("Padding", zeroPaddingMessage)}
  `;
}
