export const INPUT_MODES = ["decimal", "hex", "binary"] as const;

export type InputMode = (typeof INPUT_MODES)[number];
