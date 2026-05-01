export interface ParsedLooseBinaryInput {
  bits: bigint;
  width: number;
}

export function parseLooseBinaryInput(input: string): ParsedLooseBinaryInput {
  const normalized = input.trim().toLowerCase().replaceAll("_", "").replace(/^0b/, "");

  if (!/^[01]+$/.test(normalized)) {
    throw new Error(`Invalid binary input: ${input}`);
  }

  return {
    bits: BigInt(`0b${normalized}`),
    width: normalized.length,
  };
}
