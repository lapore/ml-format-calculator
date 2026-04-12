import assert from "node:assert/strict";
import test from "node:test";

type Listener = (event: FakeEvent) => void;
type AbortListener = () => void;
type AbortSignalLike = {
  aborted: boolean;
  addEventListener(type: "abort", listener: AbortListener, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: AbortListener): void;
};
type ListenerOptions = {
  signal?: AbortSignalLike;
};
type ListenerEntry = {
  listener: Listener;
  signal: AbortSignalLike | null;
  abortListener: AbortListener | null;
};

class FakeAbortSignal implements AbortSignalLike {
  aborted = false;
  private readonly listeners = new Set<AbortListener>();

  addEventListener(type: "abort", listener: AbortListener, options?: { once?: boolean }) {
    if (type !== "abort") {
      return;
    }

    void options;
    this.listeners.add(listener);
  }

  removeEventListener(type: "abort", listener: AbortListener) {
    if (type !== "abort") {
      return;
    }

    this.listeners.delete(listener);
  }

  dispatchAbort() {
    this.aborted = true;
    for (const listener of [...this.listeners]) {
      listener();
    }
    this.listeners.clear();
  }
}

class FakeAbortController {
  readonly signal = new FakeAbortSignal();

  abort() {
    this.signal.dispatchAbort();
  }
}

class FakeClassList {
  private readonly tokens = new Set<string>();

  add(...tokens: string[]) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  remove(...tokens: string[]) {
    for (const token of tokens) {
      this.tokens.delete(token);
    }
  }

  toggle(token: string, force?: boolean): boolean {
    if (force === true) {
      this.tokens.add(token);
      return true;
    }

    if (force === false) {
      this.tokens.delete(token);
      return false;
    }

    if (this.tokens.has(token)) {
      this.tokens.delete(token);
      return false;
    }

    this.tokens.add(token);
    return true;
  }

  contains(token: string): boolean {
    return this.tokens.has(token);
  }
}

class FakeEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly key: string | undefined;
  defaultPrevented = false;
  target: FakeElement | null = null;

  constructor(type: string, options: { bubbles?: boolean; key?: string } = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? true;
    this.key = options.key;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }
}

class FakeDocument {
  activeElement: FakeElement | null = null;
  private readonly elementsById = new Map<string, FakeElement>();

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  register(element: FakeElement): FakeElement {
    if (element.id.length > 0) {
      this.elementsById.set(element.id, element);
    }

    return element;
  }

  querySelector<T extends FakeElement>(selector: string): T | null {
    if (!selector.startsWith("#")) {
      return null;
    }

    return (this.elementsById.get(selector.slice(1)) as T | undefined) ?? null;
  }
}

class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  id = "";
  value = "";
  disabled = false;
  tabIndex = 0;
  type = "";

  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, ListenerEntry[]>();
  private textContentValue = "";
  private innerHTMLValue = "";

  constructor(tagName: string, ownerDocument: FakeDocument, id = "") {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.id = id;
  }

  get textContent(): string {
    return this.textContentValue;
  }

  set textContent(value: string | null) {
    this.textContentValue = value ?? "";
    this.innerHTMLValue = "";
    this.children.length = 0;
  }

  get innerHTML(): string {
    return this.innerHTMLValue;
  }

  set innerHTML(value: string) {
    this.innerHTMLValue = value;
    this.textContentValue = "";
    this.children.length = 0;
    this.parseInnerHtml(value);
  }

  append(...children: FakeElement[]) {
    this.innerHTMLValue = "";
    this.textContentValue = "";

    for (const child of children) {
      this.appendChildInternal(child);
    }
  }

  addEventListener(type: string, listener: Listener, options: ListenerOptions = {}) {
    if (options.signal?.aborted) {
      return;
    }

    const listeners = this.listeners.get(type) ?? [];
    const entry: ListenerEntry = {
      listener,
      signal: options.signal ?? null,
      abortListener: null,
    };

    if (options.signal) {
      const abortListener = () => {
        this.removeEventListener(type, listener);
      };
      entry.abortListener = abortListener;
      options.signal.addEventListener("abort", abortListener, { once: true });
    }

    listeners.push(entry);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    const nextListeners = listeners.filter((entry) => {
      if (entry.listener !== listener) {
        return true;
      }

      if (entry.signal && entry.abortListener) {
        entry.signal.removeEventListener("abort", entry.abortListener);
      }

      return false;
    });

    if (nextListeners.length === 0) {
      this.listeners.delete(type);
      return;
    }

    this.listeners.set(type, nextListeners);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }

  dispatchEvent(event: FakeEvent): boolean {
    if (event.target === null) {
      event.target = this;
    }

    const listeners = this.listeners.get(event.type) ?? [];
    for (const entry of listeners) {
      entry.listener(event);
    }

    if (event.bubbles && this.parentElement !== null) {
      this.parentElement.dispatchEvent(event);
    }

    return !event.defaultPrevented;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  closest<T extends FakeElement>(selector: string): T | null {
    let current: FakeElement | null = this;

    while (current !== null) {
      if (current.matches(selector)) {
        return current as T;
      }

      current = current.parentElement;
    }

    return null;
  }

  matches(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }

    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }

    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);

    if (name === "id") {
      this.id = value;
      this.ownerDocument.register(this);
      return;
    }

    if (name === "class") {
      for (const token of value.split(/\s+/).filter(Boolean)) {
        this.classList.add(token);
      }
      return;
    }

    if (name === "value") {
      this.value = value;
      return;
    }

    if (name === "type") {
      this.type = value;
      return;
    }

    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      this.dataset[key] = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  private appendChildInternal(child: FakeElement) {
    child.parentElement = this;
    this.children.push(child);
  }

  private parseInnerHtml(value: string) {
    if (!value.includes("<")) {
      return;
    }

    const tagPattern = /<([a-zA-Z][\w:-]*)([^>]*)>/g;
    let match: RegExpExecArray | null = tagPattern.exec(value);

    while (match !== null) {
      const [, tagName, attributeText] = match;
      if (!tagName.startsWith("/")) {
        const child = new FakeElement(tagName, this.ownerDocument);
        const attributePattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g;
        let attributeMatch: RegExpExecArray | null = attributePattern.exec(attributeText);

        while (attributeMatch !== null) {
          const [, attributeName, attributeValue = ""] = attributeMatch;
          child.setAttribute(attributeName, attributeValue);
          attributeMatch = attributePattern.exec(attributeText);
        }

        this.appendChildInternal(child);
      }

      match = tagPattern.exec(value);
    }
  }
}

class FakeWindow {
  private nextHandle = 1;
  private readonly animationFrames = new Map<number, FrameRequestCallback>();
  private readonly timers = new Map<number, () => void>();

  requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle++;
    this.animationFrames.set(handle, callback);
    return handle;
  };

  cancelAnimationFrame = (handle: number) => {
    this.animationFrames.delete(handle);
  };

  setTimeout = (callback: () => void): number => {
    const handle = this.nextHandle++;
    this.timers.set(handle, callback);
    return handle;
  };

  clearTimeout = (handle: number) => {
    this.animationFrames.delete(handle);
    this.timers.delete(handle);
  };

  flush() {
    while (this.animationFrames.size > 0 || this.timers.size > 0) {
      const animationFrames = [...this.animationFrames.values()];
      this.animationFrames.clear();
      for (const callback of animationFrames) {
        callback(0);
      }

      const timers = [...this.timers.values()];
      this.timers.clear();
      for (const callback of timers) {
        callback();
      }
    }
  }
}

type Fixture = {
  app: FakeElement;
  document: FakeDocument;
  window: FakeWindow;
};

function createFixture(): Fixture {
  const document = new FakeDocument();
  const window = new FakeWindow();
  const app = new FakeElement("div", document, "app");

  document.register(app);

  return { app, document, window };
}

function requireElement<T extends FakeElement>(document: FakeDocument, id: string): T {
  const element = document.querySelector<T>(`#${id}`);
  assert.ok(element, `Expected #${id} to exist`);
  return element;
}

test("app bootstraps the shell, keeps mode-switch wiring accessible, and avoids listener leaks on re-bootstrap", async () => {
  const fixture = createFixture();
  const globals = globalThis as {
    AbortController?: unknown;
    document?: unknown;
    window?: unknown;
  };
  const originalAbortController = globals.AbortController;
  const originalDocument = globals.document;
  const originalWindow = globals.window;

  globals.AbortController = FakeAbortController as unknown as typeof AbortController;
  globals.document = fixture.document as unknown as Document;
  globals.window = fixture.window as unknown as Window;

  try {
    await import(new URL("../../src/ui/app.ts?bootstrap=1", import.meta.url).href);

    const sourceFormat = requireElement<FakeElement>(fixture.document, "source-format");
    const targetFormat = requireElement<FakeElement>(fixture.document, "target-format");
    const inputMode = requireElement<FakeElement>(fixture.document, "input-mode");
    const roundingMode = requireElement<FakeElement>(fixture.document, "rounding-mode");
    const nanPolicy = requireElement<FakeElement>(fixture.document, "nan-policy");
    const canonicalNaN = requireElement<FakeElement>(fixture.document, "canonical-nan");
    const inputValue = requireElement<FakeElement>(fixture.document, "input-value");
    const presetList = requireElement<FakeElement>(fixture.document, "preset-list");
    const modeSwitch = requireElement<FakeElement>(fixture.document, "mode-switch");

    assert.ok(fixture.app.children.length > 0);
    assert.match(roundingMode.innerHTML, /value="RTP"/);
    assert.equal(roundingMode.value, "RNE");
    assert.equal(sourceFormat.listenerCount("change"), 1);
    assert.equal(targetFormat.listenerCount("change"), 1);
    assert.equal(inputMode.listenerCount("change"), 1);
    assert.equal(roundingMode.listenerCount("change"), 1);
    assert.equal(nanPolicy.listenerCount("change"), 1);
    assert.equal(canonicalNaN.listenerCount("input"), 1);
    assert.equal(canonicalNaN.listenerCount("change"), 1);
    assert.equal(inputValue.listenerCount("input"), 1);
    assert.equal(inputValue.listenerCount("change"), 1);
    assert.equal(presetList.listenerCount("click"), 1);
    assert.equal(modeSwitch.listenerCount("click"), 1);
    assert.equal(modeSwitch.listenerCount("keydown"), 1);

    await import(new URL("../../src/ui/app.ts?bootstrap=2", import.meta.url).href);

    assert.equal(sourceFormat.listenerCount("change"), 1);
    assert.equal(targetFormat.listenerCount("change"), 1);
    assert.equal(inputMode.listenerCount("change"), 1);
    assert.equal(roundingMode.listenerCount("change"), 1);
    assert.equal(nanPolicy.listenerCount("change"), 1);
    assert.equal(canonicalNaN.listenerCount("input"), 1);
    assert.equal(canonicalNaN.listenerCount("change"), 1);
    assert.equal(inputValue.listenerCount("input"), 1);
    assert.equal(inputValue.listenerCount("change"), 1);
    assert.equal(presetList.listenerCount("click"), 1);
    assert.equal(modeSwitch.listenerCount("click"), 1);
    assert.equal(modeSwitch.listenerCount("keydown"), 1);

    assert.equal(modeSwitch.getAttribute("role"), "radiogroup");
    assert.equal(modeSwitch.children.length, 2);

    const conversionButton = modeSwitch.children[0];
    const inspectionButton = modeSwitch.children[1];

    assert.equal(conversionButton?.getAttribute("role"), "radio");
    assert.equal(conversionButton?.getAttribute("aria-checked"), "true");
    assert.equal(conversionButton?.tabIndex, 0);
    assert.equal(inspectionButton?.getAttribute("aria-checked"), "false");
    assert.equal(inspectionButton?.tabIndex, -1);

    inspectionButton?.dispatchEvent(new FakeEvent("click"));
    fixture.window.flush();

    const targetFormatBlock = requireElement<FakeElement>(fixture.document, "target-format-block");
    const nanPolicyBlock = requireElement<FakeElement>(fixture.document, "nan-policy-block");
    const targetPanel = requireElement<FakeElement>(fixture.document, "target-panel");
    const canonicalNaNBlock = requireElement<FakeElement>(fixture.document, "canonical-nan-block");
    const stageHeading = requireElement<FakeElement>(fixture.document, "stage-heading");
    const stageDescription = requireElement<FakeElement>(fixture.document, "stage-description");
    const roundingModeBlock = requireElement<FakeElement>(fixture.document, "rounding-mode-block");

    assert.equal(conversionButton?.getAttribute("aria-checked"), "false");
    assert.equal(conversionButton?.tabIndex, -1);
    assert.equal(inspectionButton?.getAttribute("aria-checked"), "true");
    assert.equal(inspectionButton?.tabIndex, 0);
    assert.equal(targetFormatBlock.classList.contains("is-hidden"), true);
    assert.equal(nanPolicyBlock.classList.contains("is-hidden"), true);
    assert.equal(targetPanel.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaNBlock.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaN.disabled, true);
    assert.equal(stageHeading.textContent, "Inspection Stage");
    assert.match(stageDescription.textContent, /source format/i);

    inputMode.value = "binary";
    inputMode.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();
    assert.equal(roundingModeBlock.classList.contains("is-hidden"), true);

    inputMode.value = "decimal";
    inputMode.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();
    assert.equal(roundingModeBlock.classList.contains("is-hidden"), false);

    inspectionButton?.focus();
    inspectionButton?.dispatchEvent(new FakeEvent("keydown", { key: "ArrowLeft" }));
    fixture.window.flush();

    assert.equal(conversionButton?.getAttribute("aria-checked"), "true");
    assert.equal(inspectionButton?.getAttribute("aria-checked"), "false");
    assert.equal(fixture.document.activeElement, conversionButton);
    assert.equal(targetFormatBlock.classList.contains("is-hidden"), false);
    assert.equal(targetPanel.classList.contains("is-hidden"), false);
    assert.equal(stageHeading.textContent, "Conversion Stages");

    targetFormat.value = "INT32";
    targetFormat.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();

    assert.equal(nanPolicyBlock.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaNBlock.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaN.disabled, true);

    targetFormat.value = "FP16";
    targetFormat.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();

    assert.equal(nanPolicyBlock.classList.contains("is-hidden"), false);
    assert.equal(canonicalNaNBlock.classList.contains("is-hidden"), false);

    sourceFormat.value = "INT32";
    sourceFormat.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();

    assert.equal(nanPolicyBlock.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaNBlock.classList.contains("is-hidden"), true);
    assert.equal(canonicalNaN.disabled, true);

    sourceFormat.value = "FP32";
    sourceFormat.dispatchEvent(new FakeEvent("change"));
    fixture.window.flush();

    assert.equal(nanPolicyBlock.classList.contains("is-hidden"), false);
    assert.equal(canonicalNaNBlock.classList.contains("is-hidden"), false);
  } finally {
    globals.AbortController = originalAbortController;
    globals.document = originalDocument;
    globals.window = originalWindow;
  }
});
