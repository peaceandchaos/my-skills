import assert from "node:assert/strict";
import { test } from "node:test";
import { STARTING_CASH } from "../lighter/config";
import {
  applyMarks,
  cancelOrder,
  equity,
  flattenMarket,
  freshAccount,
  place,
  positionFor,
  recordJev,
  unrealized,
} from "./broker";

const ticket = {
  marketId: 1,
  symbol: "BTC",
  mark: 50_000,
  feeBps: 2,
  source: "ticket" as const,
  minQuote: 10,
};

test("freshAccount starts at STARTING_CASH and flat", () => {
  const a = freshAccount();
  assert.equal(a.cash, STARTING_CASH);
  assert.equal(a.startingCash, STARTING_CASH);
  assert.equal(a.positions.length, 0);
  assert.equal(a.fills.length, 0);
  assert.equal(a.realizedPnl, 0);
  assert.equal(equity(a, {}), STARTING_CASH);
});

test("place rejects a quote under minQuote without mutating", () => {
  const a = freshAccount();
  const out = place(a, {
    ...ticket,
    side: "buy",
    type: "market",
    quoteUsd: 5,
    leverage: 3,
  });
  assert.equal(out.error, "Min order is 10 USDC");
  assert.equal(out.account, a);
  assert.equal(a.fills.length, 0);
});

test("limit without a price is rejected", () => {
  const out = place(freshAccount(), {
    ...ticket,
    side: "buy",
    type: "limit",
    quoteUsd: 15,
    leverage: 3,
  });
  assert.equal(out.error, "Limit needs a price");
  assert.equal(out.account.orders.length, 0);
});

test("limit rests and cancelOrder removes it", () => {
  const placed = place(freshAccount(), {
    ...ticket,
    side: "buy",
    type: "limit",
    quoteUsd: 15,
    leverage: 3,
    limitPrice: 49_000,
  });
  assert.equal(placed.error, undefined);
  assert.equal(placed.account.orders.length, 1);
  assert.equal(placed.account.fills.length, 0);
  const gone = cancelOrder(placed.account, placed.account.orders[0].id);
  assert.equal(gone.orders.length, 0);
});

test("market buy opens a long and records a fill", () => {
  const out = place(freshAccount(), {
    ...ticket,
    side: "buy",
    type: "market",
    quoteUsd: 15,
    leverage: 3,
  });
  assert.equal(out.error, undefined);
  const pos = positionFor(out.account, 1);
  assert.ok(pos);
  assert.equal(pos?.sign, 1);
  assert.equal(out.account.fills.length, 1);
  assert.equal(out.account.fills[0].side, "buy");
  assert.ok(out.account.cash < STARTING_CASH);
  assert.ok(pos && Math.abs(unrealized(pos, pos.avgEntry)) < 1e-9);
});

test("not enough free collateral is rejected", () => {
  const out = place(freshAccount(1), {
    ...ticket,
    side: "buy",
    type: "market",
    quoteUsd: 15,
    leverage: 3,
  });
  assert.equal(out.error, "Not enough free collateral");
  assert.equal(out.account.positions.length, 0);
});

test("reduce-only with no position errors", () => {
  const out = place(freshAccount(), {
    ...ticket,
    side: "sell",
    type: "market",
    quoteUsd: 15,
    leverage: 3,
    reduceOnly: true,
  });
  assert.equal(out.error, "Nothing to reduce");
});

test("flattenMarket closes the position and books realized pnl", () => {
  const opened = place(freshAccount(), {
    ...ticket,
    side: "buy",
    type: "market",
    quoteUsd: 15,
    leverage: 3,
  });
  assert.ok(opened.account.positions.length === 1);
  const flat = flattenMarket(opened.account, 1, 50_000, 2);
  assert.equal(flat.positions.length, 0);
  assert.equal(flat.closed.length, 1);
  assert.ok(flat.fills.length >= 2);
});

test("flattenMarket on a flat account is a no-op clone", () => {
  const a = freshAccount();
  const out = flattenMarket(a, 1, 50_000, 2);
  assert.equal(out.positions.length, 0);
  assert.equal(out.fills.length, 0);
  assert.notEqual(out, a);
});

test("recordJev increments calls and stores pending", () => {
  const next = recordJev(freshAccount(), {
    at: 1,
    side: "buy",
    mark: 50_000,
    marketId: 1,
    resolveAt: 2,
  });
  assert.equal(next.jevCalls, 1);
  assert.equal(next.pending.length, 1);
});

test("applyMarks fills a crossed buy limit", () => {
  const rested = place(freshAccount(), {
    ...ticket,
    side: "buy",
    type: "limit",
    quoteUsd: 15,
    leverage: 3,
    limitPrice: 50_000,
  });
  const next = applyMarks(rested.account, { 1: 49_500 }, () => 2, () => 600);
  assert.equal(next.orders.length, 0);
  assert.equal(next.positions.length, 1);
  assert.equal(next.fills.length, 1);
});
