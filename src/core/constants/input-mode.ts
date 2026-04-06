export const INPUT_MODES = ["decimal", "binary", "hex", "raw-bits"] as const;

export type InputMode = (typeof INPUT_MODES)[number];
