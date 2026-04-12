import assert from "node:assert/strict";
import test from "node:test";

import { buildHeroSubtitle, escapeHtml, getNaNRuleText } from "../../src/ui/rendering.js";

test("hero subtitle lists every supported format", () => {
  assert.equal(
    buildHeroSubtitle(["FP32", "FP16", "BF16", "E5M2", "E4M3", "E2M1", "INT32"]),
    "Inspect FP32, FP16, BF16, E5M2, E4M3, E2M1, and INT32 side by side.",
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

test("escapeHtml escapes unsafe HTML characters", () => {
  assert.equal(
    escapeHtml(`<tag attr="quoted">'single' & more>`),
    "&lt;tag attr=&quot;quoted&quot;&gt;&#39;single&#39; &amp; more&gt;",
  );
});
