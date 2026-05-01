import assert from "node:assert/strict";
import test from "node:test";

import { extractBitSlice } from "../../src/core/subfield/extract-bit-slice.js";

test("extracts the low nibble from binary input with underscores", () => {
  const result = extractBitSlice({
    inputMode: "binary",
    inputValue: "0b1010_1010",
    minBit: 0,
    maxBit: 3,
  });

  assert.equal(result.normalizedInputBinary, "10101010");
  assert.equal(result.normalizedInputHex, "0xaa");
  assert.equal(result.rangeLabel, "[3:0]");
  assert.equal(result.sliceBinary, "1010");
  assert.equal(result.sliceHex, "0xa");
  assert.equal(result.sliceDecimal, "10");
  assert.equal(result.zeroPadBitCount, 0);
});

test("extracts a byte-aligned field from hex input with underscores", () => {
  const result = extractBitSlice({
    inputMode: "hex",
    inputValue: "0xAB_CD",
    minBit: 8,
    maxBit: 15,
  });

  assert.equal(result.normalizedInputBinary, "1010101111001101");
  assert.equal(result.normalizedInputHex, "0xabcd");
  assert.equal(result.sliceBinary, "10101011");
  assert.equal(result.sliceHex, "0xab");
  assert.equal(result.sliceDecimal, "171");
});

test("supports a single-bit slice at bit zero", () => {
  const result = extractBitSlice({
    inputMode: "binary",
    inputValue: "1010",
    minBit: 0,
    maxBit: 0,
  });

  assert.equal(result.sliceBitWidth, 1);
  assert.equal(result.sliceBinary, "0");
  assert.equal(result.sliceHex, "0x0");
  assert.equal(result.sliceDecimal, "0");
});

test("supports a two-bit slice", () => {
  const result = extractBitSlice({
    inputMode: "binary",
    inputValue: "1101",
    minBit: 1,
    maxBit: 2,
  });

  assert.equal(result.sliceBitWidth, 2);
  assert.equal(result.sliceBinary, "10");
  assert.equal(result.sliceHex, "0x2");
  assert.equal(result.sliceDecimal, "2");
});

test("zero-pads above the current input width when maxBit is larger", () => {
  const result = extractBitSlice({
    inputMode: "binary",
    inputValue: "1011",
    minBit: 2,
    maxBit: 5,
  });

  assert.equal(result.sliceBinary, "0010");
  assert.equal(result.sliceHex, "0x2");
  assert.equal(result.sliceDecimal, "2");
  assert.equal(result.zeroPadBitCount, 2);
});

test("returns zero when the entire slice is above the current input width", () => {
  const result = extractBitSlice({
    inputMode: "binary",
    inputValue: "1011",
    minBit: 6,
    maxBit: 8,
  });

  assert.equal(result.sliceBinary, "000");
  assert.equal(result.sliceHex, "0x0");
  assert.equal(result.sliceDecimal, "0");
  assert.equal(result.zeroPadBitCount, 3);
});

test("preserves input width for leading-zero hex inputs", () => {
  const result = extractBitSlice({
    inputMode: "hex",
    inputValue: "00ff",
    minBit: 8,
    maxBit: 11,
  });

  assert.equal(result.inputBitWidth, 16);
  assert.equal(result.normalizedInputBinary, "0000000011111111");
  assert.equal(result.normalizedInputHex, "0x00ff");
  assert.equal(result.sliceBinary, "0000");
});

test("accepts uppercase prefixes and preserves the requested binary width", () => {
  const result = extractBitSlice({
    inputMode: "hex",
    inputValue: "0X0A",
    minBit: 0,
    maxBit: 7,
  });

  assert.equal(result.inputBitWidth, 8);
  assert.equal(result.normalizedInputBinary, "00001010");
  assert.equal(result.normalizedInputHex, "0x0a");
  assert.equal(result.sliceBinary, "00001010");
});

test("rejects ranges where minBit is greater than maxBit", () => {
  assert.throws(
    () => extractBitSlice({
      inputMode: "binary",
      inputValue: "1010",
      minBit: 4,
      maxBit: 3,
    }),
    /maxBit must be greater than or equal to minBit/,
  );
});

test("rejects invalid input digits", () => {
  assert.throws(
    () => extractBitSlice({
      inputMode: "hex",
      inputValue: "0xzz",
      minBit: 0,
      maxBit: 3,
    }),
    /Invalid hex input/,
  );
});

test("rejects empty input after prefixes and separators are stripped", () => {
  assert.throws(
    () => extractBitSlice({
      inputMode: "binary",
      inputValue: "0b___",
      minBit: 0,
      maxBit: 0,
    }),
    /Invalid binary input/,
  );
});

test("rejects non-integer bit indexes", () => {
  assert.throws(
    () => extractBitSlice({
      inputMode: "binary",
      inputValue: "1010",
      minBit: 1.5,
      maxBit: 3,
    }),
    /minBit must be a non-negative integer/,
  );
});
