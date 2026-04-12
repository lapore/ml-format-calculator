export const CALCULATOR_MODES = ["conversion", "inspection"] as const;

export type CalculatorMode = (typeof CALCULATOR_MODES)[number];
