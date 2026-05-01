export interface ParsedLooseHexInput {
  bits: bigint;
  width: number;
}

export function parseLooseHexInput(input: string): ParsedLooseHexInput {
  const normalized = input.trim().toLowerCase().replaceAll("_", "").replace(/^0x/, "");

  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error(`Invalid hex input: ${input}`);
  }

  return {
    bits: BigInt(`0x${normalized}`),
    width: normalized.length * 4,
  };
}
