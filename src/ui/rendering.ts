export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatSupportedFormats(formats: readonly string[]): string {
  if (formats.length === 0) {
    return "";
  }

  if (formats.length === 1) {
    return formats[0] ?? "";
  }

  if (formats.length === 2) {
    return `${formats[0]} and ${formats[1]}`;
  }

  return `${formats.slice(0, -1).join(", ")}, and ${formats.at(-1)}`;
}

export function buildHeroSubtitle(formats: readonly string[]): string {
  return `Inspect ${formatSupportedFormats(formats)} side by side, or switch to Bit Slice for raw field extraction.`;
}

export function getNaNRuleText(formatId: string): string {
  if (formatId === "E4M3") {
    return "Only S 1111 111 is NaN; other all-ones exponent patterns remain finite.";
  }

  if (formatId === "UE8M0") {
    return "Only 11111111 is NaN; every other encoding is a finite power-of-two value.";
  }

  if (formatId === "ExMy") {
    return "For ExMy, NaN uses an all-ones exponent with a non-zero mantissa when NaN support is enabled.";
  }

  return "Exponent = all ones, mantissa != 0";
}
