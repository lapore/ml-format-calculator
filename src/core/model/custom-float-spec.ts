export interface CustomFloatSpec {
  hasSignBit: boolean;
  exponentBitCount: number;
  mantissaBitCount: number;
  supportsInfinity: boolean;
  supportsNaN: boolean;
}
