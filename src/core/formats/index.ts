import type { FormatId } from "../constants/format-id.js";
import type { FormatDefinition } from "../model/format-definition.js";
import { validateFormatDefinition } from "../model/format-definition.js";
import { bf16Format } from "./bf16.js";
import { e2m1Format } from "./e2m1.js";
import { e4m3Format } from "./e4m3.js";
import { e5m2Format } from "./e5m2.js";
import { fp16Format } from "./fp16.js";
import { fp32Format } from "./fp32.js";
import { int32Format } from "./int32.js";
import { ue8m0Format } from "./ue8m0.js";

export const formatRegistry: Record<FormatId, FormatDefinition> = {
  FP32: fp32Format,
  BF16: bf16Format,
  FP16: fp16Format,
  E5M2: e5m2Format,
  E4M3: e4m3Format,
  E2M1: e2m1Format,
  UE8M0: ue8m0Format,
  INT32: int32Format,
};

export const formats = Object.values(formatRegistry);

for (const format of formats) {
  validateFormatDefinition(format);
}

export function getFormatDefinition(id: FormatId): FormatDefinition {
  return formatRegistry[id];
}
