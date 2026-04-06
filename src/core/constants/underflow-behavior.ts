export const UNDERFLOW_BEHAVIORS = ["subnormal", "zero", "error"] as const;

export type UnderflowBehavior = (typeof UNDERFLOW_BEHAVIORS)[number];
