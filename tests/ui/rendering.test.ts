import assert from "node:assert/strict";
import test from "node:test";

import { buildHeroSubtitle, escapeHtml, getNaNRuleText } from "../../src/ui/rendering.js";

test("hero subtitle lists every supported format", () => {
  assert.equal(
    buildHeroSubtitle(["FP32", "BF16", "FP16", "E5M2", "E4M3", "E2M1", "UE8M0", "INT32", "custom ExMy"]),
    "Inspect FP32, BF16, FP16, E5M2, E4M3, E2M1, UE8M0, INT32, and custom ExMy side by side, or switch to Bit Slice for raw field extraction.",
  );
});

test("generic NaN rule remains IEEE-like for fp32", () => {
  assert.equal(getNaNRuleText("FP32"), "Exponent = all ones, mantissa != 0");
});

test("e4m3 NaN rule explains the single reserved OCP pattern", () => {
  assert.equal(
    getNaNRuleText("E4M3"),
    "Only S 1111 111 is NaN; other all-ones exponent patterns remain finite.",
  );
});

test("ue8m0 NaN rule explains the reserved all-ones encoding", () => {
  assert.equal(
    getNaNRuleText("UE8M0"),
    "Only 11111111 is NaN; every other encoding is a finite power-of-two value.",
  );
});

test("ExMy NaN rule explains the configurable IEEE-like custom behavior", () => {
  assert.equal(
    getNaNRuleText("ExMy"),
    "For ExMy, NaN uses an all-ones exponent with a non-zero mantissa when NaN support is enabled.",
  );
});

test("escapeHtml escapes unsafe HTML characters", () => {
  assert.equal(
    escapeHtml(`<tag attr="quoted">'single' & more>`),
    "&lt;tag attr=&quot;quoted&quot;&gt;&#39;single&#39; &amp; more&gt;",
  );
});
