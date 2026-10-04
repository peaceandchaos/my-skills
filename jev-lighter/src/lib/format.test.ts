import assert from "node:assert/strict";
import { test } from "node:test";
import { compactUsd, fmtBps, fmtChartTime, fmtInt, fmtMs, fmtPct, usd } from "./format";

test("usd pins two-decimal cash", () => {
  assert.equal(usd(0), "$0.00");
  assert.equal(usd(100), "$100.00");
  assert.equal(usd(92200), "$92,200.00");
  assert.equal(usd(-12.3), "-$12.30");
});

test("compactUsd follows the desk thresholds", () => {
  assert.equal(compactUsd(100), "$100.00");
  assert.equal(compactUsd(1500), "$1.5K");
  assert.equal(compactUsd(92200), "$92K");
  assert.equal(compactUsd(1_200_000), "$1.2M");
  assert.equal(compactUsd(-1500), "-$1.5K");
});

test("fmtPct takes a 0-1 rate", () => {
  assert.equal(fmtPct(0.123, 1), "12.3%");
  assert.equal(fmtPct(0.5, 0), "50%");
  assert.equal(fmtPct(-0.2, 1), "−20.0%");
});

test("fmtInt is a grouping integer", () => {
  assert.equal(fmtInt(0), "0");
  assert.equal(fmtInt(12), "12");
  assert.equal(fmtInt(1200), "1,200");
});

test("fmtChartTime coarsens the axis on hour and month windows", () => {
  const ts = Date.UTC(2026, 8, 17, 18, 45, 12) / 1000;
  assert.equal(fmtChartTime(ts, 60).split(":").length, 3);
  assert.equal(fmtChartTime(ts, 3600).includes(":"), true);
  assert.match(fmtChartTime(ts, 30 * 24 * 3600), /[A-Za-z]/);
});

test("fmtBps and fmtMs keep their units", () => {
  assert.equal(fmtBps(2.25), "2.3 bps");
  assert.equal(fmtBps(-1.4), "−1.4 bps");
  assert.equal(fmtMs(250), "250ms");
  assert.equal(fmtMs(1500), "1.50s");
});
