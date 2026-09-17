import assert from "node:assert/strict";
import { test } from "node:test";
import { mockDecide, type JevState } from "./mock";

function state(over: Partial<JevState> = {}): JevState {
  return {
    symbol: "BTC",
    marketId: 1,
    mark: 100,
    mid: 100,
    bid: 99.99,
    ask: 100.01,
    returnsBps1m: 0,
    returnsBps5m: 0,
    fundingRate: 0,
    positionSign: 0,
    lastSide: null,
    ...over,
  };
}

test("strong up-returns fire a buy when the book is tight", () => {
  const d = mockDecide(
    state({ returnsBps1m: 80, returnsBps5m: 40 }),
    0,
  );
  assert.equal(d.side, "buy");
  assert.equal(d.skipped, false);
  assert.equal(d.tradeNow, true);
  assert.ok(d.gate >= 0.55);
  assert.ok(d.pBuy > d.pSell);
});

test("strong down-returns fire a sell when the book is tight", () => {
  const d = mockDecide(
    state({ returnsBps1m: -80, returnsBps5m: -40 }),
    0,
  );
  assert.equal(d.side, "sell");
  assert.equal(d.skipped, false);
  assert.equal(d.tradeNow, true);
  assert.ok(d.pSell > d.pBuy);
});

test("a wide book gates out even with strong returns", () => {
  const d = mockDecide(
    state({
      bid: 90,
      ask: 110,
      returnsBps1m: 80,
      returnsBps5m: 40,
    }),
    0,
  );
  assert.equal(d.skipped, true);
  assert.equal(d.skipReason, "gate");
  assert.equal(d.tradeNow, false);
  assert.ok(d.gate < 0.55);
});

test("a flat book with tiny noise holds", () => {
  const d = mockDecide(state(), 0);
  assert.equal(d.side, "hold");
  assert.equal(d.skipped, true);
  assert.equal(d.skipReason, "hold");
  assert.ok(d.pHold > 0);
});

test("flip below FLIP_THRESHOLD keeps lastSide", () => {
  const incoming = mockDecide(
    state({ lastSide: null, returnsBps1m: -6, returnsBps5m: -2 }),
    50,
  );
  const kept = mockDecide(
    state({ lastSide: "buy", returnsBps1m: -6, returnsBps5m: -2 }),
    50,
  );
  assert.equal(incoming.side, "sell");
  assert.ok(incoming.pSell < 0.62);
  assert.equal(kept.side, "buy");
});
