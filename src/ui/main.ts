import { convertValue } from "../adapter/engine-api.js";
import { getDefaultCanonicalNaNHex } from "../core/constants/nan-policy.js";
import type { ConversionStageReport } from "../core/model/conversion-response.js";
import "../ui/styles.css";

const supportedFormats = ["FP32", "FP16", "BF16", "INT32"] as const;
const inputModes = ["decimal", "hex", "binary"] as const;
const roundingModes = ["RNE", "RTZ"] as const;
const nanPolicies = ["preserve", "canonical"] as const;

type SupportedFormat = (typeof supportedFormats)[number];
type InputMode = (typeof inputModes)[number];
type RoundingMode = (typeof roundingModes)[number];
type NaNPolicy = (typeof nanPolicies)[number];
type Preset = {
  label: string;
  value: string;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="page">
    <section class="hero">
      <p class="eyebrow">ML Format Calculator</p>
      <h1>Inspect numeric formats side by side</h1>
      <p class="subtitle">A minimal playground for FP32, FP16, BF16, and INT32 conversions.</p>
    </section>

    <section class="controls-panel">
      <div class="grid">
        <label>
          <span>Source format</span>
          <select id="source-format"></select>
        </label>
        <label>
          <span>Target format</span>
          <select id="target-format"></select>
        </label>
        <label>
          <span>Input mode</span>
          <select id="input-mode"></select>
        </label>
        <label>
          <span>Rounding mode</span>
          <select id="rounding-mode"></select>
        </label>
        <label>
          <span>NaN policy</span>
          <select id="nan-policy"></select>
        </label>
      </div>
      <label class="input-block" id="canonical-nan-block">
        <span>Canonical NaN</span>
        <input id="canonical-nan" type="text" value="0x7e00" />
      </label>
      <p class="hint" id="canonical-nan-hint">Used only when the target is a float format and NaN policy is canonical.</p>

      <label class="input-block">
        <span>Input value</span>
        <input id="input-value" type="text" value="6.5" />
      </label>
      <p class="hint" id="input-hint">Enter a decimal real value such as 6.5, -2.9, inf, or nan.</p>
      <div class="preset-block">
        <div class="preset-head">
          <span>Presets</span>
          <p id="preset-hint">Quick examples for the current source format and input mode.</p>
        </div>
        <div id="preset-list" class="preset-list"></div>
      </div>
    </section>

    <section class="results-grid">
      <article class="panel">
        <div class="panel-head">
          <p class="panel-label">Source</p>
          <strong id="source-title">FP32</strong>
        </div>
        <div id="source-output" class="panel-body"></div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <p class="panel-label">Target</p>
          <strong id="target-title">FP16</strong>
        </div>
        <div id="target-output" class="panel-body"></div>
      </article>
    </section>

    <section class="stage-panel">
      <div class="stage-panel-head">
        <h2>Conversion Stages</h2>
        <p>See whether the value changed at source encoding or target conversion.</p>
      </div>
      <div id="stages-output" class="stage-grid"></div>
    </section>

    <section class="messages">
      <div>
        <h2>Warnings</h2>
        <ul id="warnings"></ul>
      </div>
      <div>
        <h2>Notes</h2>
        <ul id="notes"></ul>
      </div>
    </section>
  </main>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`UI element not found: ${selector}`);
  }

  return element;
}

const sourceFormatSelect = requireElement<HTMLSelectElement>("#source-format");
const targetFormatSelect = requireElement<HTMLSelectElement>("#target-format");
const inputModeSelect = requireElement<HTMLSelectElement>("#input-mode");
const roundingModeSelect = requireElement<HTMLSelectElement>("#rounding-mode");
const nanPolicySelect = requireElement<HTMLSelectElement>("#nan-policy");
const canonicalNaNBlock = requireElement<HTMLElement>("#canonical-nan-block");
const canonicalNaNInput = requireElement<HTMLInputElement>("#canonical-nan");
const canonicalNaNHint = requireElement<HTMLElement>("#canonical-nan-hint");
const inputValueInput = requireElement<HTMLInputElement>("#input-value");
const sourceTitle = requireElement<HTMLElement>("#source-title");
const targetTitle = requireElement<HTMLElement>("#target-title");
const sourceOutput = requireElement<HTMLDivElement>("#source-output");
const targetOutput = requireElement<HTMLDivElement>("#target-output");
const stagesOutput = requireElement<HTMLDivElement>("#stages-output");
const warningsList = requireElement<HTMLUListElement>("#warnings");
const notesList = requireElement<HTMLUListElement>("#notes");
const inputHint = requireElement<HTMLElement>("#input-hint");
const presetHint = requireElement<HTMLElement>("#preset-hint");
const presetList = requireElement<HTMLDivElement>("#preset-list");

const decimalPresets: Preset[] = [
  { label: "+0", value: "0" },
  { label: "-0", value: "-0" },
  { label: "1", value: "1" },
  { label: "-1", value: "-1" },
  { label: "6.5", value: "6.5" },
  { label: "1.006", value: "1.006" },
  { label: "+inf", value: "+inf" },
  { label: "NaN", value: "nan" },
];

const rawPresets: Record<SupportedFormat, Preset[]> = {
  FP32: [
    { label: "+0", value: "0x00000000" },
    { label: "-0", value: "0x80000000" },
    { label: "1.0", value: "0x3f800000" },
    { label: "-1.0", value: "0xbf800000" },
    { label: "6.5", value: "0x40d00000" },
    { label: "min subnormal", value: "0x00000001" },
    { label: "max subnormal", value: "0x007fffff" },
    { label: "min normal", value: "0x00800000" },
    { label: "max normal", value: "0x7f7fffff" },
    { label: "+inf", value: "0x7f800000" },
    { label: "-inf", value: "0xff800000" },
    { label: "qNaN", value: "0x7fc00000" },
    { label: "sNaN", value: "0x7fa00000" },
  ],
  FP16: [
    { label: "+0", value: "0x0000" },
    { label: "-0", value: "0x8000" },
    { label: "1.0", value: "0x3c00" },
    { label: "-1.0", value: "0xbc00" },
    { label: "6.5", value: "0x4680" },
    { label: "min subnormal", value: "0x0001" },
    { label: "max subnormal", value: "0x03ff" },
    { label: "min normal", value: "0x0400" },
    { label: "max normal", value: "0x7bff" },
    { label: "+inf", value: "0x7c00" },
    { label: "-inf", value: "0xfc00" },
    { label: "qNaN", value: "0x7e00" },
    { label: "sNaN", value: "0x7d00" },
  ],
  BF16: [
    { label: "+0", value: "0x0000" },
    { label: "-0", value: "0x8000" },
    { label: "1.0", value: "0x3f80" },
    { label: "-1.0", value: "0xbf80" },
    { label: "6.5", value: "0x40d0" },
    { label: "min subnormal", value: "0x0001" },
    { label: "max subnormal", value: "0x007f" },
    { label: "min normal", value: "0x0080" },
    { label: "max normal", value: "0x7f7f" },
    { label: "+inf", value: "0x7f80" },
    { label: "-inf", value: "0xff80" },
    { label: "qNaN", value: "0x7fc1" },
    { label: "sNaN", value: "0x7f81" },
  ],
  INT32: [
    { label: "0", value: "0x00000000" },
    { label: "1", value: "0x00000001" },
    { label: "-1", value: "0xffffffff" },
    { label: "42", value: "0x0000002a" },
    { label: "-42", value: "0xffffffd6" },
    { label: "min", value: "0x80000000" },
    { label: "max", value: "0x7fffffff" },
  ],
};

const binaryPresets: Record<SupportedFormat, Preset[]> = {
  FP32: [
    { label: "+0", value: "00000000000000000000000000000000" },
    { label: "-0", value: "10000000000000000000000000000000" },
    { label: "1.0", value: "00111111100000000000000000000000" },
    { label: "-1.0", value: "10111111100000000000000000000000" },
    { label: "min subnormal", value: "00000000000000000000000000000001" },
    { label: "min normal", value: "00000000100000000000000000000000" },
    { label: "max normal", value: "01111111011111111111111111111111" },
    { label: "+inf", value: "01111111100000000000000000000000" },
    { label: "-inf", value: "11111111100000000000000000000000" },
    { label: "qNaN", value: "01111111110000000000000000000000" },
    { label: "sNaN", value: "01111111101000000000000000000000" },
  ],
  FP16: [
    { label: "+0", value: "0000000000000000" },
    { label: "-0", value: "1000000000000000" },
    { label: "1.0", value: "0011110000000000" },
    { label: "-1.0", value: "1011110000000000" },
    { label: "min subnormal", value: "0000000000000001" },
    { label: "min normal", value: "0000010000000000" },
    { label: "max normal", value: "0111101111111111" },
    { label: "+inf", value: "0111110000000000" },
    { label: "-inf", value: "1111110000000000" },
    { label: "qNaN", value: "0111111000000000" },
    { label: "sNaN", value: "0111110100000000" },
  ],
  BF16: [
    { label: "+0", value: "0000000000000000" },
    { label: "-0", value: "1000000000000000" },
    { label: "1.0", value: "0011111110000000" },
    { label: "-1.0", value: "1011111110000000" },
    { label: "min subnormal", value: "0000000000000001" },
    { label: "min normal", value: "0000000010000000" },
    { label: "max normal", value: "0111111101111111" },
    { label: "+inf", value: "0111111110000000" },
    { label: "-inf", value: "1111111110000000" },
    { label: "qNaN", value: "0111111111000001" },
    { label: "sNaN", value: "0111111110000001" },
  ],
  INT32: [
    { label: "0", value: "00000000000000000000000000000000" },
    { label: "1", value: "00000000000000000000000000000001" },
    { label: "-1", value: "11111111111111111111111111111111" },
    { label: "42", value: "00000000000000000000000000101010" },
    { label: "-42", value: "11111111111111111111111111010110" },
    { label: "min", value: "10000000000000000000000000000000" },
    { label: "max", value: "01111111111111111111111111111111" },
  ],
};

function renderOptions(
  select: HTMLSelectElement,
  options: readonly string[],
  selected: string,
) {
  select.innerHTML = options
    .map((option) => `<option value="${option}" ${option === selected ? "selected" : ""}>${option}</option>`)
    .join("");
}

function getCanonicalNaNValue(formatId: SupportedFormat): string {
  return getDefaultCanonicalNaNHex(formatId) ?? "";
}

function syncCanonicalNaNControls(targetFormatId: SupportedFormat, nanPolicy: NaNPolicy) {
  const defaultValue = getCanonicalNaNValue(targetFormatId);
  const hasConfigurableCanonicalNaN = defaultValue.length > 0;
  const targetChanged = canonicalNaNInput.dataset.targetFormatId !== targetFormatId;

  canonicalNaNInput.dataset.targetFormatId = targetFormatId;
  canonicalNaNInput.dataset.defaultValue = defaultValue;

  if (targetChanged || canonicalNaNInput.value.trim().length === 0) {
    canonicalNaNInput.value = defaultValue;
  }

  const enabled = hasConfigurableCanonicalNaN && nanPolicy === "canonical";
  canonicalNaNBlock.classList.toggle("disabled", !enabled);
  canonicalNaNInput.disabled = !enabled;

  if (!hasConfigurableCanonicalNaN) {
    canonicalNaNHint.textContent = "Canonical NaN applies only to FP32, FP16, and BF16 target formats.";
  } else if (nanPolicy === "canonical") {
    canonicalNaNHint.textContent = `Default ${targetFormatId} canonical NaN is ${defaultValue}. You can override it with another valid NaN bit pattern.`;
  } else {
    canonicalNaNHint.textContent = "Switch NaN policy to canonical to use a custom target NaN value.";
  }
}

function renderList(element: HTMLUListElement, items: string[]) {
  element.innerHTML = items.length
    ? items.map((item) => `<li>${item}</li>`).join("")
    : "<li class=\"muted\">None</li>";
}

function getPresets(sourceFormatId: SupportedFormat, inputMode: InputMode): Preset[] {
  if (inputMode === "decimal") {
    return decimalPresets;
  }

  if (inputMode === "hex") {
    return rawPresets[sourceFormatId];
  }

  return binaryPresets[sourceFormatId];
}

function renderPresets(sourceFormatId: SupportedFormat, inputMode: InputMode) {
  const presets = getPresets(sourceFormatId, inputMode);
  presetHint.textContent =
    inputMode === "decimal"
      ? "Decimal presets are shared across formats."
      : `Showing ${inputMode} presets for ${sourceFormatId}.`;

  presetList.innerHTML = presets
    .map(
      (preset) => `
        <button class="preset-button" type="button" data-preset-value="${preset.value}">
          <span>${preset.label}</span>
          <code>${preset.value}</code>
        </button>
      `,
    )
    .join("");

  presetList.querySelectorAll<HTMLButtonElement>(".preset-button").forEach((button) => {
    button.addEventListener("click", () => {
      inputValueInput.value = button.dataset.presetValue ?? "";
      render();
    });
  });
}

function renderField(label: string, value: string) {
  return `
    <div class="field">
      <span class="field-label">${label}</span>
      <code>${value}</code>
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

function renderEquationBlock(decoded: {
  classification: string;
  sign: string;
  signBit: string | null;
  exponentBits: string | null;
  mantissaBits: string | null;
  exponentBias: number | null;
  storedBiasedExponent: number | null;
  actualExponent: number | null;
  decimalValueText: string;
  nanKind: string | null;
  formatId: string;
}) {
  const signExponent = decoded.sign === "NEG" ? "1" : "0";
  const signTerm = decoded.sign === "NEG" ? "-1" : "+1";

  if (decoded.classification === "ZERO") {
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${decoded.decimalValueText}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>Exponent = 0 and mantissa = 0</code></div>
          <div class="equation-line"><span>Result</span><code>${decoded.decimalValueText}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "INF") {
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${decoded.decimalValueText}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>Exponent = all ones, mantissa = 0</code></div>
          <div class="equation-line"><span>Sign term</span><code>(-1)^${signExponent} = ${signTerm}</code></div>
          <div class="equation-line"><span>Result</span><code>${decoded.decimalValueText}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "NAN") {
    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${decoded.nanKind ?? "NaN"}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Rule</span><code>Exponent = all ones, mantissa != 0</code></div>
          <div class="equation-line"><span>Kind</span><code>${decoded.nanKind ?? "NaN"}</code></div>
        </div>
      </details>
    `;
  }

  if (decoded.classification === "INTEGER") {
    const signRule = decoded.sign === "NEG"
      ? "Sign bit is 1, so interpret the raw bits using two's complement."
      : "Sign bit is 0, so the raw bits are already the positive integer value.";

    return `
      <details class="equation-block">
        <summary class="equation-summary">
          <span class="field-label">Equation</span>
          <code>${decoded.decimalValueText}</code>
        </summary>
        <div class="equation-details">
          <div class="equation-line"><span>Sign bit</span><code>${decoded.signBit ?? "n/a"} -> ${decoded.sign}</code></div>
          <div class="equation-line"><span>Interpretation</span><code>${signRule}</code></div>
          <div class="equation-line"><span>Result</span><code>${decoded.decimalValueText}</code></div>
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

  return `
    <details class="equation-block">
      <summary class="equation-summary">
        <span class="field-label">Equation</span>
        <code>value = (-1)^${signExponent} × ${significandPrefix}.${mantissaBits || "0"} × ${exponentTerm}</code>
      </summary>
      <div class="equation-details">
        <div class="equation-line"><span>Sign term</span><code>(-1)^${signExponent} = ${signTerm}</code></div>
        <div class="equation-line"><span>Stored exponent</span><code>${decoded.storedBiasedExponent ?? "n/a"}</code></div>
        <div class="equation-line"><span>Bias</span><code>${decoded.exponentBias ?? "n/a"}</code></div>
        <div class="equation-line"><span>Actual exponent</span><code>${exponentDerivation}</code></div>
        <div class="equation-line"><span>Mantissa bits</span><code>${mantissaBits || "0"}</code></div>
        <div class="equation-line"><span>Significand</span><code>${significandPrefix}.${mantissaBits || "0"} = ${significandValue}</code></div>
        <div class="equation-line"><span>Final value</span><code>${decoded.decimalValueText}</code></div>
      </div>
    </details>
  `;
}

function renderBitGroups(decoded: {
  rawBinary: string;
  signBit: string | null;
  exponentBits: string | null;
  mantissaBits: string | null;
}) {
  const hasStructuredBits =
    decoded.signBit !== null || decoded.exponentBits !== null || decoded.mantissaBits !== null;

  if (!hasStructuredBits) {
    return renderField("Binary", decoded.rawBinary);
  }

  const signChunk = decoded.signBit
    ? `<span class="bit-chunk sign">${decoded.signBit}</span>`
    : "";
  const exponentChunk = decoded.exponentBits
    ? `<span class="bit-chunk exponent">${decoded.exponentBits}</span>`
    : "";
  const mantissaChunk = decoded.mantissaBits
    ? `<span class="bit-chunk mantissa">${decoded.mantissaBits}</span>`
    : "";

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
      <code class="bit-raw">${decoded.rawBinary}</code>
    </div>
  `;
}

function renderStage(stage: ConversionStageReport) {
  const title = stage.stage === "input-to-source" ? "Input -> Source" : "Source -> Target";
  const valueStatus = stage.valueChanged ? "Value changed" : "Value preserved";
  const modeStatus = !stage.applied
    ? "exact decode"
    : stage.roundingModeApplied
      ? "rounding used"
      : "no numeric rounding";

  return `
    <article class="stage-card ${stage.valueChanged ? "changed" : "stable"}">
      <div class="stage-top">
        <div>
          <p class="stage-label">${title}</p>
          <strong>${valueStatus}</strong>
        </div>
        <div class="stage-badges">
          <span class="badge ${stage.valueChanged ? "alert" : "subtle"}">${valueStatus}</span>
          <span class="badge subtle">${modeStatus}</span>
        </div>
      </div>
      <p class="stage-summary">${stage.summary}</p>
    </article>
  `;
}

function renderPanel(decoded: {
  formatId: string;
  classification: string;
  sign: string;
  rawBinary: string;
  rawHex: string;
  decimalValueText: string;
  signBit: string | null;
  exponentBits: string | null;
  mantissaBits: string | null;
  exponentBias: number | null;
  storedBiasedExponent: number | null;
  actualExponent: number | null;
  nanKind: string | null;
}) {
  return `
    <div class="stat-row">
      <div class="badge">${decoded.classification}</div>
      <div class="badge subtle">sign: ${decoded.sign}</div>
      ${decoded.nanKind ? `<div class="badge subtle">${decoded.nanKind}</div>` : ""}
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

function updateHint(mode: InputMode) {
  const messages: Record<InputMode, string> = {
    decimal: "Enter a decimal real value such as 6.5, -2.9, inf, or nan.",
    hex: "Enter raw bits in hex, for example 0x40d00000 for FP32 6.5.",
    binary: "Enter raw bits in binary, for example 01000000110100000000000000000000.",
  };

  inputHint.textContent = messages[mode];
}

function render() {
  const sourceFormatId = sourceFormatSelect.value as SupportedFormat;
  const targetFormatId = targetFormatSelect.value as SupportedFormat;
  const inputMode = inputModeSelect.value as InputMode;
  const roundingMode = roundingModeSelect.value as RoundingMode;
  const nanPolicy = nanPolicySelect.value as NaNPolicy;
  syncCanonicalNaNControls(targetFormatId, nanPolicy);
  const canonicalNaNValue = canonicalNaNInput.value;
  const inputValue = inputValueInput.value;

  sourceTitle.textContent = sourceFormatId;
  targetTitle.textContent = targetFormatId;
  updateHint(inputMode);
  renderPresets(sourceFormatId, inputMode);

  try {
    const result = convertValue({
      sourceFormatId,
      targetFormatId,
      inputMode,
      inputValue,
      roundingMode,
      nanPolicy,
      canonicalNaNInput: canonicalNaNValue,
    });

    sourceOutput.innerHTML = renderPanel(result.source);
    targetOutput.innerHTML =
      result.target.classification === "UNREPRESENTABLE"
        ? `<p class="error">${result.targetError ?? result.target.decimalValueText}</p>`
        : renderPanel(result.target);
    stagesOutput.innerHTML = result.stages.map(renderStage).join("");
    renderList(warningsList, result.warnings);
    renderList(notesList, result.notes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sourceOutput.innerHTML = `<p class="error">Unable to decode source: ${message}</p>`;
    targetOutput.innerHTML = `<p class="muted">Target view unavailable until the input parses successfully.</p>`;
    stagesOutput.innerHTML = `<p class="muted">Stage details appear after a successful conversion.</p>`;
    renderList(warningsList, []);
    renderList(notesList, [message]);
  }
}

renderOptions(sourceFormatSelect, supportedFormats, "FP32");
renderOptions(targetFormatSelect, supportedFormats, "FP16");
renderOptions(inputModeSelect, inputModes, "decimal");
renderOptions(roundingModeSelect, roundingModes, "RNE");
renderOptions(nanPolicySelect, nanPolicies, "canonical");

for (const element of [
  sourceFormatSelect,
  targetFormatSelect,
  inputModeSelect,
  roundingModeSelect,
  nanPolicySelect,
  canonicalNaNInput,
  inputValueInput,
]) {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
}

render();
