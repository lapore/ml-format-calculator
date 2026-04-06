export const SIGN_KINDS = ["POS", "NEG", "NONE"] as const;

export type SignKind = (typeof SIGN_KINDS)[number];
