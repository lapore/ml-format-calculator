export function formatBinary(bits: bigint, width: number): string {
  return bits.toString(2).padStart(width, "0");
}

export function formatHex(bits: bigint, width: number): string {
  const hexWidth = Math.ceil(width / 4);
  return `0x${bits.toString(16).padStart(hexWidth, "0")}`;
}

export function maskForWidth(width: number): bigint {
  return (1n << BigInt(width)) - 1n;
}
