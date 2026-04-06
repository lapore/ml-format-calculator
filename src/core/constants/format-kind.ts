export const FORMAT_KINDS = ["float", "unsigned-float", "integer"] as const;

export type FormatKind = (typeof FORMAT_KINDS)[number];
