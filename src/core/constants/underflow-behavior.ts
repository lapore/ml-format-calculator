export const UNDERFLOW_BEHAVIORS = ["subnormal", "zero", "saturate", "error"] as const;

export type UnderflowBehavior = (typeof UNDERFLOW_BEHAVIORS)[number];
