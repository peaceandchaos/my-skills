import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANDLE_WINDOWS,
  DESK_WINDOWS,
  LINE_WINDOWS,
  STARTING_CASH,
} from "./config";

test("STARTING_CASH stays at the paper $100 wallet", () => {
  assert.equal(STARTING_CASH, 100);
});

test("DESK_WINDOWS is the unique union of Liveline chip lists", () => {
  const chipSecs = [...LINE_WINDOWS, ...CANDLE_WINDOWS].map((w) => w.secs);
  const deskSecs = DESK_WINDOWS.map((w) => w.secs);
  assert.deepEqual(deskSecs, [...new Set(chipSecs)].sort((a, b) => a - b));
  assert.equal(new Set(deskSecs).size, deskSecs.length);
  for (const w of LINE_WINDOWS) {
    assert.ok(deskSecs.includes(w.secs));
  }
  for (const w of CANDLE_WINDOWS) {
    assert.ok(deskSecs.includes(w.secs));
  }
});
