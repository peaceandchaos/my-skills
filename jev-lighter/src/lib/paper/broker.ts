import {
  MAX_LEVERAGE,
  PAPER_SLIP_BPS,
  STARTING_CASH,
} from "@/lib/lighter/config";
import type {
  Account,
  Fill,
  OrderType,
  Position,
  RestingOrder,
  Side,
} from "@/lib/types";

export function freshAccount(cash = STARTING_CASH): Account {
  return {
    cash,
    startingCash: cash,
    positions: [],
    fills: [],
    orders: [],
    closed: [],
    realizedPnl: 0,
    jevCalls: 0,
    jevHits: 0,
    jevResolved: 0,
    pending: [],
  };
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampLev(n: number) {
  return Math.max(1, Math.min(MAX_LEVERAGE, n));
}

function slipPx(mark: number, side: Side) {
  const [lo, hi] = PAPER_SLIP_BPS;
  const bps = lo + Math.random() * (hi - lo);
  const signed = side === "buy" ? bps : -bps;
  return { px: mark * (1 + signed / 1e4), slipBps: bps };
}

export function unrealized(pos: Position, mark: number) {
  return pos.sign * (mark - pos.avgEntry) * pos.base;
}

export function liqPrice(pos: Position, mmf: number) {
  const maint = mmf / 10_000;
  const move = pos.margin / pos.base - pos.avgEntry * maint;
  if (pos.sign === 1) return Math.max(0, pos.avgEntry - move);
  return pos.avgEntry + move;
}

export function equity(account: Account, marks: Record<number, number>) {
  let eq = account.cash;
  for (const pos of account.positions) {
    const mark = marks[pos.marketId] ?? pos.avgEntry;
    eq += pos.margin + unrealized(pos, mark);
  }
  return eq;
}

export function positionFor(account: Account, marketId: number) {
  return account.positions.find((p) => p.marketId === marketId);
}

type PlaceArgs = {
  marketId: number;
  symbol: string;
  side: Side;
  type: OrderType;
  quoteUsd: number;
  leverage: number;
  mark: number;
  feeBps: number;
  reduceOnly?: boolean;
  sl?: number;
  tp?: number;
  limitPrice?: number;
  source: Fill["source"];
  minQuote: number;
};

function clone(account: Account): Account {
  return {
    ...account,
    positions: account.positions.map((p) => ({ ...p })),
    fills: account.fills.slice(),
    orders: account.orders.slice(),
    closed: account.closed.slice(),
    pending: account.pending.slice(),
  };
}

function closeBase(
  account: Account,
  pos: Position,
  base: number,
  px: number,
  fee: number,
) {
  const pnl = pos.sign * (px - pos.avgEntry) * base;
  const frac = base / pos.base;
  const marginReleased = pos.margin * frac;
  account.cash += marginReleased + pnl - fee;
  account.realizedPnl += pnl - fee;
  pos.base -= base;
  pos.margin -= marginReleased;
  if (pos.base <= 1e-12) {
    account.closed.push({
      at: Date.now(),
      marketId: pos.marketId,
      symbol: pos.symbol,
      pnl: pnl - fee,
      notional: px * base,
      win: pnl - fee > 0,
    });
    account.positions = account.positions.filter((p) => p !== pos);
  }
}

export function place(account: Account, args: PlaceArgs): { account: Account; error?: string } {
  const next = clone(account);
  const quote = Math.max(0, args.quoteUsd);
  if (quote < args.minQuote) {
    return { account, error: `Min order is ${args.minQuote} USDC` };
  }
  if (args.type === "limit" && !(args.limitPrice && args.limitPrice > 0)) {
    return { account, error: "Limit needs a price" };
  }
  if (args.type === "limit") {
    const order: RestingOrder = {
      id: id(),
      marketId: args.marketId,
      symbol: args.symbol,
      side: args.side,
      type: "limit",
      limitPrice: args.limitPrice!,
      quoteUsd: quote,
      leverage: clampLev(args.leverage),
      reduceOnly: !!args.reduceOnly,
      sl: args.sl,
      tp: args.tp,
      createdAt: Date.now(),
    };
    next.orders.push(order);
    return { account: next };
  }
  return fillMarket(next, args);
}

function fillMarket(account: Account, args: PlaceArgs): { account: Account; error?: string } {
  const { px, slipBps } = slipPx(args.mark, args.side);
  const feeBps = Math.max(0, args.feeBps);
  const notional = args.quoteUsd;
  const fee = notional * (feeBps / 1e4);
  const base = notional / px;
  const lev = clampLev(args.leverage);
  const pos = positionFor(account, args.marketId);
  const wantSign: 1 | -1 = args.side === "buy" ? 1 : -1;

  if (pos && pos.sign !== wantSign) {
    const closeAmt = Math.min(pos.base, base);
    closeBase(account, pos, closeAmt, px, fee * (closeAmt / base));
    const leftover = base - closeAmt;
    if (args.reduceOnly || leftover <= 1e-12) {
      pushFill(account, args, closeAmt, px, notional * (closeAmt / base), fee * (closeAmt / base), slipBps, feeBps);
      return { account };
    }
    return openOrAdd(account, { ...args, quoteUsd: leftover * px }, px, leftover, leftover * px, fee * (leftover / base), slipBps, feeBps, lev);
  }

  if (args.reduceOnly) {
    if (!pos || pos.sign !== wantSign) {
      return { account, error: "Nothing to reduce" };
    }
  }

  return openOrAdd(account, args, px, base, notional, fee, slipBps, feeBps, lev);
}

function openOrAdd(
  account: Account,
  args: PlaceArgs,
  px: number,
  base: number,
  notional: number,
  fee: number,
  slipBps: number,
  feeBps: number,
  lev: number,
): { account: Account; error?: string } {
  const marginNeeded = notional / lev;
  if (account.cash + 1e-9 < marginNeeded + fee) {
    return { account, error: "Not enough free collateral" };
  }
  account.cash -= marginNeeded + fee;
  const wantSign: 1 | -1 = args.side === "buy" ? 1 : -1;
  let pos = positionFor(account, args.marketId);
  if (!pos) {
    pos = {
      marketId: args.marketId,
      symbol: args.symbol,
      sign: wantSign,
      base,
      avgEntry: px,
      leverage: lev,
      margin: marginNeeded,
      openedAt: Date.now(),
      sl: args.sl,
      tp: args.tp,
    };
    account.positions.push(pos);
  } else {
    const newBase = pos.base + base;
    pos.avgEntry = (pos.avgEntry * pos.base + px * base) / newBase;
    pos.base = newBase;
    pos.margin += marginNeeded;
    pos.leverage = lev;
    if (args.sl) pos.sl = args.sl;
    if (args.tp) pos.tp = args.tp;
  }
  pushFill(account, args, base, px, notional, fee, slipBps, feeBps);
  return { account };
}

function pushFill(
  account: Account,
  args: PlaceArgs,
  base: number,
  px: number,
  notional: number,
  fee: number,
  slipBps: number,
  feeBps: number,
) {
  const fill: Fill = {
    id: id(),
    at: Date.now(),
    marketId: args.marketId,
    symbol: args.symbol,
    side: args.side,
    type: args.type,
    base,
    price: px,
    mark: args.mark,
    notional,
    fee,
    feeBps,
    slipBps,
    reduceOnly: !!args.reduceOnly,
    status: "filled",
    source: args.source,
  };
  account.fills.unshift(fill);
  account.fills = account.fills.slice(0, 200);
}

export function flattenMarket(
  account: Account,
  marketId: number,
  mark: number,
  feeBps: number,
  source: Fill["source"] = "flatten",
): Account {
  const next = clone(account);
  const pos = positionFor(next, marketId);
  if (!pos) return next;
  const side: Side = pos.sign === 1 ? "sell" : "buy";
  const quote = pos.base * mark;
  fillMarket(next, {
    marketId,
    symbol: pos.symbol,
    side,
    type: "market",
    quoteUsd: quote,
    leverage: pos.leverage,
    mark,
    feeBps,
    reduceOnly: true,
    source,
    minQuote: 0,
  });
  return next;
}

export function cancelOrder(account: Account, orderId: string): Account {
  const next = clone(account);
  next.orders = next.orders.filter((o) => o.id !== orderId);
  return next;
}

export function applyMarks(
  account: Account,
  marks: Record<number, number>,
  feeBpsFor: (marketId: number) => number,
  mmfFor: (marketId: number) => number,
): Account {
  let next = clone(account);

  for (const pos of [...next.positions]) {
    const mark = marks[pos.marketId];
    if (!mark) continue;
    const u = unrealized(pos, mark);
    const liq = liqPrice(pos, mmfFor(pos.marketId));
    const hitLiq = pos.sign === 1 ? mark <= liq : mark >= liq;
    const hitSl =
      pos.sl != null && (pos.sign === 1 ? mark <= pos.sl : mark >= pos.sl);
    const hitTp =
      pos.tp != null && (pos.sign === 1 ? mark >= pos.tp : mark <= pos.tp);
    if (hitLiq) {
      next = flattenMarket(next, pos.marketId, mark, feeBpsFor(pos.marketId), "liq");
    } else if (hitSl) {
      next = flattenMarket(next, pos.marketId, mark, feeBpsFor(pos.marketId), "sl");
    } else if (hitTp) {
      next = flattenMarket(next, pos.marketId, mark, feeBpsFor(pos.marketId), "tp");
    } else if (u < -pos.margin * 0.98) {
      next = flattenMarket(next, pos.marketId, mark, feeBpsFor(pos.marketId), "liq");
    }
  }

  for (const order of [...next.orders]) {
    const mark = marks[order.marketId];
    if (!mark) continue;
    const crossed =
      order.side === "buy" ? mark <= order.limitPrice : mark >= order.limitPrice;
    if (!crossed) continue;
    next.orders = next.orders.filter((o) => o.id !== order.id);
    const placed = fillMarket(next, {
      marketId: order.marketId,
      symbol: order.symbol,
      side: order.side,
      type: "limit",
      quoteUsd: order.quoteUsd,
      leverage: order.leverage,
      mark,
      feeBps: feeBpsFor(order.marketId),
      reduceOnly: order.reduceOnly,
      sl: order.sl,
      tp: order.tp,
      source: "ticket",
      minQuote: 0,
    });
    next = placed.account;
  }

  const now = Date.now();
  const still: typeof next.pending = [];
  for (const p of next.pending) {
    if (now < p.resolveAt) {
      still.push(p);
      continue;
    }
    const mark = marks[p.marketId];
    next.jevResolved += 1;
    if (mark) {
      const ok = p.side === "buy" ? mark > p.mark : mark < p.mark;
      if (ok) next.jevHits += 1;
    }
  }
  next.pending = still;
  return next;
}

export function recordJev(
  account: Account,
  pending: Account["pending"][number] | null,
): Account {
  const next = clone(account);
  next.jevCalls += 1;
  if (pending) next.pending.push(pending);
  return next;
}
