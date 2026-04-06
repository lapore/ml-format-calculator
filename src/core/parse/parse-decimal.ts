export function parseDecimalInput(input: string): number {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();
  const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

  if (normalized.length === 0) {
    throw new Error("Decimal input cannot be empty");
  }

  if (normalized === "inf" || normalized === "+inf" || normalized === "infinity" || normalized === "+infinity") {
    return Number.POSITIVE_INFINITY;
  }

  if (normalized === "-inf" || normalized === "-infinity") {
    return Number.NEGATIVE_INFINITY;
  }

  if (normalized === "nan") {
    return Number.NaN;
  }

  if (normalized === "+nan" || normalized === "-nan") {
    throw new Error(`Signed decimal NaN input is not supported: ${input}. Use "nan" or raw bits instead.`);
  }

  if (!decimalPattern.test(trimmed)) {
    throw new Error(`Invalid decimal input: ${input}`);
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid decimal input: ${input}`);
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`Decimal input is out of range: ${input}`);
  }

  return parsed;
}
