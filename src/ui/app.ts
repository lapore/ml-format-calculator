import { convertValue } from "../adapter/engine-api.js";
import { CALCULATOR_MODES } from "../core/constants/calculator-mode.js";
import { INPUT_MODES } from "../core/constants/input-mode.js";
import { getDefaultCanonicalNaNHex } from "../core/constants/nan-policy.js";
import { ROUNDING_MODES, type RoundingMode } from "../core/constants/rounding.js";
import { buildHeroSubtitle, escapeHtml } from "./rendering.js";
import { renderPanel, renderStage, renderStatusMessage } from "./templates.js";
import {
  getCanonicalNaNUiState,
  getConversionRequestKey,
  getModeUiState,
  shouldRefreshPresets,
  shouldShowNaNPolicyControls,
} from "./view-model.js";

const supportedFormats = ["FP32", "BF16", "FP16", "E5M2", "E4M3", "E2M1", "UE8M0", "INT32"] as const;
const calculatorModes = CALCULATOR_MODES;
const inputModes = INPUT_MODES;
const roundingModes = ROUNDING_MODES;
const nanPolicies = ["preserve", "canonical"] as const;

type SupportedFormat = (typeof supportedFormats)[number];
type CalculatorMode = (typeof calculatorModes)[number];
type InputMode = (typeof inputModes)[number];
type NaNPolicy = (typeof nanPolicies)[number];
type Preset = {
  label: string;
  value: string;
};

type AppRoot = HTMLDivElement & {
  __mlFormatCalculatorCleanup__?: () => void;
};

const app = document.querySelector<HTMLDivElement>("#app") as AppRoot | null;

if (!app) {
  throw new Error("App root not found");
}

app.__mlFormatCalculatorCleanup__?.();

function renderAppShell(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="page">
      <section class="hero">
        <p class="eyebrow">ML Format Calculator</p>
        <h1>Inspect numeric formats side by side</h1>
        <p class="subtitle">${escapeHtml(buildHeroSubtitle(supportedFormats))}</p>
      </section>

      <section class="controls-panel">
        <div class="mode-switch" id="mode-switch" role="radiogroup" aria-label="Calculator mode"></div>
        <div class="grid">
          <label>
            <span>Source format</span>
            <select id="source-format"></select>
          </label>
          <label id="target-format-block">
            <span>Target format</span>
            <select id="target-format"></select>
          </label>
          <label>
            <span>Input mode</span>
            <select id="input-mode"></select>
          </label>
          <label id="rounding-mode-block">
            <span>Rounding mode</span>
            <select id="rounding-mode"></select>
          </label>
          <label id="nan-policy-block">
            <span>NaN policy</span>
            <select id="nan-policy"></select>
          </label>
        </div>
        <label class="input-block" id="canonical-nan-block">
          <span>Canonical NaN</span>
          <input id="canonical-nan" type="text" value="0x7e00" />
        </label>
        <p class="hint" id="canonical-nan-hint">Used only when both source and target formats define NaN encodings and NaN policy is canonical.</p>

        <label class="input-block">
          <span>Input value</span>
          <input id="input-value" type="text" value="6.5" />
        </label>
        <p class="hint" id="input-hint">Enter a decimal real value such as 6.5, -2.9, 1e-3, inf or infinity, or nan.</p>
        <div class="preset-block">
          <div class="preset-head">
            <span>Presets</span>
            <p id="preset-hint">Quick examples for the current source format and input mode.</p>
          </div>
          <div id="preset-list" class="preset-list"></div>
        </div>
      </section>

      <section class="results-grid" id="results-grid">
        <article class="panel">
          <div class="panel-head">
            <p class="panel-label">Source</p>
            <strong id="source-title">FP32</strong>
          </div>
          <div id="source-output" class="panel-body"></div>
        </article>

        <article class="panel" id="target-panel">
          <div class="panel-head">
            <p class="panel-label">Target</p>
            <strong id="target-title">FP16</strong>
          </div>
          <div id="target-output" class="panel-body"></div>
        </article>
      </section>

      <section class="stage-panel">
        <div class="stage-panel-head">
          <h2 id="stage-heading">Conversion Stages</h2>
          <p id="stage-description">See whether the value changed at source encoding or target conversion.</p>
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
}

if (!document.querySelector("#source-format")) {
  renderAppShell(app);
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`UI element not found: ${selector}`);
  }

  return element;
}

const sourceFormatSelect = requireElement<HTMLSelectElement>("#source-format");
const modeSwitch = requireElement<HTMLDivElement>("#mode-switch");
const targetFormatBlock = requireElement<HTMLElement>("#target-format-block");
const targetFormatSelect = requireElement<HTMLSelectElement>("#target-format");
const inputModeSelect = requireElement<HTMLSelectElement>("#input-mode");
const roundingModeBlock = requireElement<HTMLElement>("#rounding-mode-block");
const roundingModeSelect = requireElement<HTMLSelectElement>("#rounding-mode");
const nanPolicyBlock = requireElement<HTMLElement>("#nan-policy-block");
const nanPolicySelect = requireElement<HTMLSelectElement>("#nan-policy");
const canonicalNaNBlock = requireElement<HTMLElement>("#canonical-nan-block");
const canonicalNaNInput = requireElement<HTMLInputElement>("#canonical-nan");
const canonicalNaNHint = requireElement<HTMLElement>("#canonical-nan-hint");
const inputValueInput = requireElement<HTMLInputElement>("#input-value");
const sourceTitle = requireElement<HTMLElement>("#source-title");
const targetTitle = requireElement<HTMLElement>("#target-title");
const resultsGrid = requireElement<HTMLElement>("#results-grid");
const sourceOutput = requireElement<HTMLDivElement>("#source-output");
const targetPanel = requireElement<HTMLElement>("#target-panel");
const targetOutput = requireElement<HTMLDivElement>("#target-output");
const stageHeading = requireElement<HTMLElement>("#stage-heading");
const stageDescription = requireElement<HTMLElement>("#stage-description");
const stagesOutput = requireElement<HTMLDivElement>("#stages-output");
const warningsList = requireElement<HTMLUListElement>("#warnings");
const notesList = requireElement<HTMLUListElement>("#notes");
const inputHint = requireElement<HTMLElement>("#input-hint");
const presetHint = requireElement<HTMLElement>("#preset-hint");
const presetList = requireElement<HTMLDivElement>("#preset-list");
let selectedMode: CalculatorMode = "conversion";
let lastPresetRenderState: { sourceFormatId: SupportedFormat; inputMode: InputMode } | null = null;
let lastConversionRequestKey: string | null = null;
let renderQueued = false;
let pendingInputRenderId: number | null = null;
let pendingRenderHandle: number | null = null;
let pendingRenderKind: "animation-frame" | "timeout" | null = null;
const renderCache = new WeakMap<Element, string>();
const modeButtons = new Map<CalculatorMode, HTMLButtonElement>();
const listenerController = new AbortController();
const TEXT_INPUT_DEBOUNCE_MS = 140;

function cleanupApp() {
  listenerController.abort();

  if (pendingInputRenderId !== null) {
    window.clearTimeout(pendingInputRenderId);
    pendingInputRenderId = null;
  }

  if (pendingRenderHandle !== null) {
    if (pendingRenderKind === "animation-frame") {
      window.cancelAnimationFrame?.(pendingRenderHandle);
    } else {
      window.clearTimeout(pendingRenderHandle);
    }

    pendingRenderHandle = null;
    pendingRenderKind = null;
  }

  renderQueued = false;
}

app.__mlFormatCalculatorCleanup__ = cleanupApp;

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
  E5M2: [
    { label: "+0", value: "0x00" },
    { label: "-0", value: "0x80" },
    { label: "1.0", value: "0x3c" },
    { label: "-1.0", value: "0xbc" },
    { label: "6.0", value: "0x46" },
    { label: "min subnormal", value: "0x01" },
    { label: "max subnormal", value: "0x03" },
    { label: "min normal", value: "0x04" },
    { label: "max normal", value: "0x7b" },
    { label: "+inf", value: "0x7c" },
    { label: "-inf", value: "0xfc" },
    { label: "NaN", value: "0x7d" },
  ],
  E4M3: [
    { label: "+0", value: "0x00" },
    { label: "-0", value: "0x80" },
    { label: "1.0", value: "0x38" },
    { label: "-1.0", value: "0xb8" },
    { label: "6.5", value: "0x4d" },
    { label: "min subnormal", value: "0x01" },
    { label: "max subnormal", value: "0x07" },
    { label: "min normal", value: "0x08" },
    { label: "max normal", value: "0x7e" },
    { label: "NaN", value: "0x7f" },
  ],
  E2M1: [
    { label: "+0", value: "0x0" },
    { label: "-0", value: "0x8" },
    { label: "1.0", value: "0x2" },
    { label: "-1.0", value: "0xa" },
    { label: "1.5", value: "0x3" },
    { label: "min subnormal", value: "0x1" },
    { label: "min normal", value: "0x2" },
    { label: "max normal", value: "0x7" },
  ],
  UE8M0: [
    { label: "min normal", value: "0x00" },
    { label: "0.5", value: "0x7e" },
    { label: "1.0", value: "0x7f" },
    { label: "2.0", value: "0x80" },
    { label: "max normal", value: "0xfe" },
    { label: "NaN", value: "0xff" },
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
  E5M2: [
    { label: "+0", value: "00000000" },
    { label: "-0", value: "10000000" },
    { label: "1.0", value: "00111100" },
    { label: "-1.0", value: "10111100" },
    { label: "min subnormal", value: "00000001" },
    { label: "min normal", value: "00000100" },
    { label: "max normal", value: "01111011" },
    { label: "+inf", value: "01111100" },
    { label: "-inf", value: "11111100" },
    { label: "NaN", value: "01111101" },
  ],
  E4M3: [
    { label: "+0", value: "00000000" },
    { label: "-0", value: "10000000" },
    { label: "1.0", value: "00111000" },
    { label: "-1.0", value: "10111000" },
    { label: "min subnormal", value: "00000001" },
    { label: "min normal", value: "00001000" },
    { label: "max normal", value: "01111110" },
    { label: "NaN", value: "01111111" },
  ],
  E2M1: [
    { label: "+0", value: "0000" },
    { label: "-0", value: "1000" },
    { label: "1.0", value: "0010" },
    { label: "-1.0", value: "1010" },
    { label: "min subnormal", value: "0001" },
    { label: "min normal", value: "0010" },
    { label: "max normal", value: "0111" },
  ],
  UE8M0: [
    { label: "min normal", value: "00000000" },
    { label: "0.5", value: "01111110" },
    { label: "1.0", value: "01111111" },
    { label: "2.0", value: "10000000" },
    { label: "max normal", value: "11111110" },
    { label: "NaN", value: "11111111" },
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
  updateHTML(
    select,
    options
      .map((option) => {
        const escapedOption = escapeHtml(option);
        return `<option value="${escapedOption}" ${option === selected ? "selected" : ""}>${escapedOption}</option>`;
      })
      .join(""),
  );
  select.value = selected;
}

function renderModeButtons(selectedModeValue: CalculatorMode) {
  if (modeButtons.size === 0) {
    modeSwitch.innerHTML = "";
    modeSwitch.setAttribute("role", "radiogroup");
    if (!modeSwitch.getAttribute("aria-label")) {
      modeSwitch.setAttribute("aria-label", "Calculator mode");
    }

    for (const mode of calculatorModes) {
      const button = document.createElement("button");
      const label = mode[0]?.toUpperCase() + mode.slice(1);

      button.type = "button";
      button.classList.add("mode-button");
      button.dataset.mode = mode;
      button.textContent = label;
      button.setAttribute("role", "radio");
      modeSwitch.append(button);
      modeButtons.set(mode, button);
    }
  }

  for (const mode of calculatorModes) {
    const button = modeButtons.get(mode);
    if (!button) {
      continue;
    }

    const selected = mode === selectedModeValue;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
  }
}

function getCanonicalNaNValue(formatId: SupportedFormat): string {
  return getDefaultCanonicalNaNHex(formatId) ?? "";
}

function syncCanonicalNaNControls(
  mode: CalculatorMode,
  sourceFormatId: SupportedFormat,
  targetFormatId: SupportedFormat,
  nanPolicy: NaNPolicy,
) {
  const defaultValue = getCanonicalNaNValue(targetFormatId);
  const targetChanged = canonicalNaNInput.dataset.targetFormatId !== targetFormatId;

  canonicalNaNInput.dataset.targetFormatId = targetFormatId;
  canonicalNaNInput.dataset.defaultValue = defaultValue;

  if (targetChanged || canonicalNaNInput.value.trim().length === 0) {
    canonicalNaNInput.value = defaultValue;
  }

  const uiState = getCanonicalNaNUiState(mode, sourceFormatId, targetFormatId, nanPolicy, defaultValue);
  canonicalNaNBlock.classList.toggle("is-hidden", !uiState.visible);
  canonicalNaNHint.classList.toggle("is-hidden", !uiState.visible);
  canonicalNaNBlock.classList.toggle("disabled", !uiState.enabled);
  canonicalNaNInput.disabled = !uiState.enabled;
  canonicalNaNHint.textContent = uiState.hint;
}

function syncModeControls(
  mode: CalculatorMode,
  inputMode: InputMode,
  sourceFormatId: SupportedFormat,
  targetFormatId: SupportedFormat,
  nanPolicy: NaNPolicy,
) {
  const uiState = getModeUiState(mode, inputMode);
  const showNaNControls = shouldShowNaNPolicyControls(mode, sourceFormatId, targetFormatId);

  renderModeButtons(mode);
  targetFormatBlock.classList.toggle("is-hidden", !uiState.showTargetControls);
  nanPolicyBlock.classList.toggle("is-hidden", !showNaNControls);
  roundingModeBlock.classList.toggle("is-hidden", !uiState.showRoundingControl);
  targetPanel.classList.toggle("is-hidden", !uiState.showTargetPanel);
  resultsGrid.classList.toggle("single-panel", !uiState.showTargetPanel);
  stageHeading.textContent = uiState.stageHeading;
  stageDescription.textContent = uiState.stageDescription;
  syncCanonicalNaNControls(mode, sourceFormatId, targetFormatId, nanPolicy);
}

function renderList(element: HTMLUListElement, items: string[]) {
  updateHTML(
    element,
    items.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li class=\"muted\">None</li>",
  );
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

  updateHTML(
    presetList,
    presets
      .map((preset) => {
        const escapedLabel = escapeHtml(preset.label);
        const escapedValue = escapeHtml(preset.value);
        return `
          <button class="preset-button" type="button" data-preset-value="${escapedValue}">
            <span>${escapedLabel}</span>
            <code>${escapedValue}</code>
          </button>
        `;
      })
      .join(""),
  );
}

function updateHTML(element: Element, nextHTML: string) {
  const previousHTML = renderCache.get(element);
  if (previousHTML === nextHTML) {
    return;
  }

  element.innerHTML = nextHTML;
  renderCache.set(element, nextHTML);
}

function queueRender() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  const flush = () => {
    renderQueued = false;
    pendingRenderHandle = null;
    pendingRenderKind = null;
    render();
  };

  if (typeof window.requestAnimationFrame === "function") {
    pendingRenderKind = "animation-frame";
    pendingRenderHandle = window.requestAnimationFrame(flush);
    return;
  }

  pendingRenderKind = "timeout";
  pendingRenderHandle = window.setTimeout(flush, 0);
}

function scheduleImmediateRender() {
  if (pendingInputRenderId !== null) {
    window.clearTimeout(pendingInputRenderId);
    pendingInputRenderId = null;
  }

  queueRender();
}

function scheduleTextInputRender() {
  if (pendingInputRenderId !== null) {
    window.clearTimeout(pendingInputRenderId);
  }

  pendingInputRenderId = window.setTimeout(() => {
    pendingInputRenderId = null;
    queueRender();
  }, TEXT_INPUT_DEBOUNCE_MS);
}

function updateHint(mode: InputMode) {
  const messages: Record<InputMode, string> = {
    decimal: "Enter a decimal real value such as 6.5, -2.9, 1e-3, inf or infinity, or nan.",
    hex: "Enter raw bits in hex, for example 0x40d00000 for FP32 6.5.",
    binary: "Enter raw bits in binary, for example 01000000110100000000000000000000.",
  };

  inputHint.textContent = messages[mode];
}

function isClosestCapable(target: EventTarget | null): target is Element {
  return typeof (target as { closest?: unknown } | null)?.closest === "function";
}

function getModeFromButton(button: HTMLButtonElement): CalculatorMode | null {
  const nextMode = button.dataset.mode as CalculatorMode | undefined;
  return nextMode && calculatorModes.includes(nextMode) ? nextMode : null;
}

function getAdjacentMode(currentMode: CalculatorMode, direction: -1 | 1): CalculatorMode {
  const currentIndex = calculatorModes.indexOf(currentMode);
  const nextIndex = (currentIndex + direction + calculatorModes.length) % calculatorModes.length;
  return calculatorModes[nextIndex] ?? currentMode;
}

function getModeForKey(key: string, currentMode: CalculatorMode): CalculatorMode | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowUp":
      return getAdjacentMode(currentMode, -1);
    case "ArrowRight":
    case "ArrowDown":
      return getAdjacentMode(currentMode, 1);
    case "Home":
      return calculatorModes[0] ?? currentMode;
    case "End":
      return calculatorModes[calculatorModes.length - 1] ?? currentMode;
    default:
      return null;
  }
}

function render() {
  const mode = selectedMode;
  const sourceFormatId = sourceFormatSelect.value as SupportedFormat;
  const targetFormatId = targetFormatSelect.value as SupportedFormat;
  const inputMode = inputModeSelect.value as InputMode;
  const roundingMode = roundingModeSelect.value as RoundingMode;
  const nanPolicy = nanPolicySelect.value as NaNPolicy;
  syncModeControls(mode, inputMode, sourceFormatId, targetFormatId, nanPolicy);
  const canonicalNaNValue = canonicalNaNInput.value;
  const inputValue = inputValueInput.value;
  const nextPresetRenderState = { sourceFormatId, inputMode };
  const request = mode === "inspection"
    ? {
        mode,
        sourceFormatId,
        inputMode,
        inputValue,
        roundingMode,
      }
    : {
        mode,
        sourceFormatId,
        targetFormatId,
        inputMode,
        inputValue,
        roundingMode,
        nanPolicy,
        canonicalNaNInput: canonicalNaNValue,
      };
  const requestKey = getConversionRequestKey(request);

  sourceTitle.textContent = sourceFormatId;
  targetTitle.textContent = targetFormatId;
  updateHint(inputMode);
  if (shouldRefreshPresets(lastPresetRenderState, nextPresetRenderState)) {
    renderPresets(sourceFormatId, inputMode);
    lastPresetRenderState = nextPresetRenderState;
  }

  if (requestKey === lastConversionRequestKey) {
    return;
  }
  lastConversionRequestKey = requestKey;

  try {
    const result = convertValue(request);

    updateHTML(sourceOutput, renderPanel(result.source));
    updateHTML(
      targetOutput,
      result.target === null
        ? ""
        : result.target.classification === "UNREPRESENTABLE"
          ? renderStatusMessage("error", result.targetError ?? result.target.decimalValueText)
          : renderPanel(result.target),
    );
    updateHTML(stagesOutput, result.stages.map(renderStage).join(""));
    renderList(warningsList, result.warnings);
    renderList(notesList, result.notes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateHTML(sourceOutput, renderStatusMessage("error", `Unable to decode source: ${message}`));
    updateHTML(
      targetOutput,
      mode === "inspection"
        ? ""
        : renderStatusMessage("muted", "Target view unavailable until the input parses successfully."),
    );
    updateHTML(
      stagesOutput,
      renderStatusMessage(
        "muted",
        mode === "inspection"
          ? "Stage details appear after a successful inspection."
          : "Stage details appear after a successful conversion.",
      ),
    );
    renderList(warningsList, []);
    renderList(notesList, [message]);
  }
}

renderOptions(sourceFormatSelect, supportedFormats, "FP32");
renderOptions(targetFormatSelect, supportedFormats, "FP16");
renderOptions(inputModeSelect, inputModes, "decimal");
renderOptions(roundingModeSelect, roundingModes, "RNE");
renderOptions(nanPolicySelect, nanPolicies, "canonical");
renderModeButtons(selectedMode);

for (const element of [
  sourceFormatSelect,
  targetFormatSelect,
  inputModeSelect,
  roundingModeSelect,
  nanPolicySelect,
]) {
  element.addEventListener("change", scheduleImmediateRender, {
    signal: listenerController.signal,
  });
}

modeSwitch.addEventListener("click", (event) => {
  if (!isClosestCapable(event.target)) {
    return;
  }

  const button = event.target.closest<HTMLButtonElement>(".mode-button");
  if (!button) {
    return;
  }

  const nextMode = getModeFromButton(button);
  if (!nextMode || nextMode === selectedMode) {
    return;
  }

  selectedMode = nextMode;
  scheduleImmediateRender();
}, {
  signal: listenerController.signal,
});

modeSwitch.addEventListener("keydown", (event) => {
  if (!isClosestCapable(event.target)) {
    return;
  }

  const button = event.target.closest<HTMLButtonElement>(".mode-button");
  if (!button) {
    return;
  }

  const currentMode = getModeFromButton(button);
  if (!currentMode) {
    return;
  }

  const nextMode = getModeForKey(event.key, currentMode);
  if (!nextMode) {
    return;
  }

  event.preventDefault();
  if (nextMode !== selectedMode) {
    selectedMode = nextMode;
    scheduleImmediateRender();
  }

  modeButtons.get(nextMode)?.focus();
}, {
  signal: listenerController.signal,
});

for (const element of [
  canonicalNaNInput,
  inputValueInput,
]) {
  element.addEventListener("input", scheduleTextInputRender, {
    signal: listenerController.signal,
  });
  element.addEventListener("change", scheduleImmediateRender, {
    signal: listenerController.signal,
  });
}

presetList.addEventListener("click", (event) => {
  if (!isClosestCapable(event.target)) {
    return;
  }

  const button = event.target.closest<HTMLButtonElement>(".preset-button");
  if (!button) {
    return;
  }

  inputValueInput.value = button.dataset.presetValue ?? "";
  scheduleImmediateRender();
}, {
  signal: listenerController.signal,
});

render();
