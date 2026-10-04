import assert from "node:assert/strict";
import { test } from "node:test";
import { closesFromCandles, mergeLineHistory, trimTicks } from "./series";

test("mergeLineHistory keeps candle closes in front of live ticks", () => {
  const history = [
    { time: 100, value: 1 },
    { time: 160, value: 2 },
    { time: 220, value: 3 },
  ];
  const ticks = [
    { time: 221, value: 3.1 },
    { time: 222, value: 3.2 },
  ];
  assert.deepEqual(mergeLineHistory(history, ticks), [
    { time: 100, value: 1 },
    { time: 160, value: 2 },
    { time: 220, value: 3 },
    { time: 221, value: 3.1 },
    { time: 222, value: 3.2 },
  ]);
});

test("mergeLineHistory does not drop history when ticks are empty", () => {
  const history = [{ time: 1, value: 10 }];
  assert.equal(mergeLineHistory(history, []), history);
});

test("trimTicks keeps the recent window under the cap", () => {
  const ticks = [
    { time: 1, value: 1 },
    { time: 50, value: 2 },
    { time: 100, value: 3 },
  ];
  assert.deepEqual(trimTicks(ticks, 100, 60, 10), [
    { time: 50, value: 2 },
    { time: 100, value: 3 },
  ]);
  const many = Array.from({ length: 5 }, (_, i) => ({ time: 90 + i, value: i }));
  assert.equal(trimTicks(many, 94, 60, 3).length, 3);
});

test("closesFromCandles is mark history for the line", () => {
  assert.deepEqual(
    closesFromCandles([
      { time: 1, close: 10 },
      { time: 2, close: 11 },
    ]),
    [
      { time: 1, value: 10 },
      { time: 2, value: 11 },
    ],
  );
});
