export function parseHexInput(input: string, expectedBitWidth?: number): bigint {
  const normalized = input.trim().toLowerCase().replace(/^0x/, "");

  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error(`Invalid hex input: ${input}`);
  }

  if (expectedBitWidth !== undefined) {
    const expectedHexWidth = Math.ceil(expectedBitWidth / 4);
    if (normalized.length !== expectedHexWidth) {
      throw new Error(
        `Invalid hex width: expected ${expectedHexWidth} hex digits for ${expectedBitWidth} bits, got ${normalized.length}`,
      );
    }
  }

  return BigInt(`0x${normalized}`);
}
