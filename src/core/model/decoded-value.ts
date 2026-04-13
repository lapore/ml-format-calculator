import type { Classification } from "../constants/classifications.js";
import type { AnyFormatId } from "../constants/format-id.js";
import type { SignKind } from "../constants/sign-kind.js";

export interface DecodedValue {
  formatId: AnyFormatId;
  rawBits: bigint;
  rawBinary: string;
  rawHex: string;
  classification: Classification;
  sign: SignKind;
  signBit: string | null;
  exponentBits: string | null;
  mantissaBits: string | null;
  exponentBias: number | null;
  storedBiasedExponent: number | null;
  actualExponent: number | null;
  decimalValue: number | null;
  decimalValueText: string;
  isZero: boolean;
  isSubnormal: boolean;
  isNormal: boolean;
  isInfinity: boolean;
  isNaN: boolean;
  nanKind: "quiet" | "signaling" | null;
}
