export function parseBinaryInput(input: string, expectedWidth?: number): bigint {
  const normalized = input.trim().toLowerCase().replace(/^0b/, "");

  if (!/^[01]+$/.test(normalized)) {
    throw new Error(`Invalid binary input: ${input}`);
  }

  if (expectedWidth !== undefined && normalized.length !== expectedWidth) {
    throw new Error(
      `Invalid binary width: expected ${expectedWidth} bits, got ${normalized.length}`,
    );
  }

  return BigInt(`0b${normalized}`);
}
