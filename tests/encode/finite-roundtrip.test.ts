import assert from "node:assert/strict";
import test from "node:test";

import { decodeRawBits } from "../../src/core/decode/index.js";
import { encodeValue } from "../../src/core/encode/index.js";
import { getFormatDefinition } from "../../src/core/formats/index.js";

const exhaustivelyRoundTrippableFormats = ["FP16", "BF16", "E5M2", "E4M3", "E2M1"] as const;
const roundingModes = ["RNE", "RTZ"] as const;

for (const formatId of exhaustivelyRoundTrippableFormats) {
  test(`${formatId} round-trips every finite raw bit pattern under both rounding modes`, () => {
    const format = getFormatDefinition(formatId);
    const limit = 1 << format.bitWidth;

    for (let raw = 0; raw < limit; raw += 1) {
      const rawBits = BigInt(raw);
      const decoded = decodeRawBits(formatId, rawBits);

      if (decoded.decimalValue === null || decoded.isNaN || decoded.isInfinity) {
        continue;
      }

      for (const roundingMode of roundingModes) {
        const encoded = encodeValue(formatId, decoded.decimalValue, roundingMode);
        assert.equal(
          encoded.rawBits,
          rawBits,
          `${formatId} ${roundingMode} failed to round-trip raw ${decoded.rawHex}`,
        );
      }
    }
  });
}
