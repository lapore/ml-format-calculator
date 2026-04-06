export const NAN_POLICIES = ["preserve", "canonical"] as const;

export type NaNPolicy = (typeof NAN_POLICIES)[number];
