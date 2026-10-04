import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANDLE_WINDOWS,
  DESK_WINDOWS,
  LINE_WINDOWS,
  MONTH_SECS,
  STARTING_CASH,
  candleSpec,
} from "./config";

test("STARTING_CASH stays at the paper $100 wallet", () => {
  assert.equal(STARTING_CASH, 100);
});

test("DESK_WINDOWS is one Liveline list from 1m through Month", () => {
  assert.equal(LINE_WINDOWS, DESK_WINDOWS);
  assert.equal(CANDLE_WINDOWS, DESK_WINDOWS);
  assert.deepEqual(
    DESK_WINDOWS.map((w) => w.label),
    ["5m", "1m", "15m", "1h", "Month"],
  );
  assert.deepEqual(
    DESK_WINDOWS.map((w) => w.secs),
    [300, 60, 900, 3600, MONTH_SECS],
  );
  assert.equal(new Set(DESK_WINDOWS.map((w) => w.secs)).size, DESK_WINDOWS.length);
});

test("candleSpec follows Benji's window with Lighter resolutions", () => {
  assert.deepEqual(candleSpec(60), { resolution: "1m", candleWidth: 60 });
  assert.deepEqual(candleSpec(300), { resolution: "1m", candleWidth: 60 });
  assert.deepEqual(candleSpec(900), { resolution: "1m", candleWidth: 60 });
  assert.deepEqual(candleSpec(3600), { resolution: "1m", candleWidth: 60 });
  assert.deepEqual(candleSpec(MONTH_SECS), { resolution: "1d", candleWidth: 86_400 });
});
