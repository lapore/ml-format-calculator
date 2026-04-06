const buffer = new ArrayBuffer(4);
const view = new DataView(buffer);

export function numberToFloat32Bits(value: number): number {
  view.setFloat32(0, value, false);
  return view.getUint32(0, false);
}
