export const APP_SECTIONS = ["calculator", "bit-slice"] as const;

export type AppSection = (typeof APP_SECTIONS)[number];
