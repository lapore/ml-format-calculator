export const BIT_SLICE_INPUT_MODES = ["binary", "hex"] as const;

export type BitSliceInputMode = (typeof BIT_SLICE_INPUT_MODES)[number];
