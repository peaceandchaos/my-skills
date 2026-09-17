import { FLIP_THRESHOLD, GATE_THRESHOLD } from "@/lib/lighter/config";
import type { JevSide } from "@/lib/types";

export type JevState = {
  symbol: string;
  marketId: number;
  mark: number;
  mid: number;
  bid: number;
  ask: number;
  returnsBps1m: number;
  returnsBps5m: number;
  fundingRate: number;
  positionSign: 0 | 1 | -1;
  lastSide: JevSide | null;
};

export type JevDecision = {
  gate: number;
  side: JevSide;
  pBuy: number;
  pSell: number;
  pHold: number;
  tradeNow: boolean;
  skipped: boolean;
  skipReason?: string;
};

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function hashNoise(mark: number, t: number) {
  const s = Math.sin(mark * 12.9898 + t * 0.001) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export function mockDecide(state: JevState, now = Date.now()): JevDecision {
  const spread =
    state.bid > 0 && state.ask > 0
      ? ((state.ask - state.bid) / state.mid) * 1e4
      : 2;
  const imbalance =
    state.bid > 0 && state.ask > 0
      ? (state.bid - (2 * state.mid - state.ask)) / Math.max(state.mid, 1e-9)
      : 0;
  const noise = hashNoise(state.mark, now) * 0.35;
  const logit =
    state.returnsBps1m / 8 +
    state.returnsBps5m / 24 +
    imbalance * 1.4 -
    state.fundingRate * 40 +
    noise;

  let pBuy = sigmoid(logit);
  let pSell = 1 - pBuy;
  const edge = Math.abs(pBuy - 0.5) * 2;
  const spreadPenalty = Math.min(1, spread / 12);
  const gate = Math.max(0, Math.min(1, edge * (1 - spreadPenalty * 0.5)));

  let side: JevSide = pBuy >= pSell ? "buy" : "sell";
  let pHold = 0;
  if (edge < 0.12) {
    side = "hold";
    pHold = 1 - edge;
    const rest = 1 - pHold;
    pBuy *= rest;
    pSell *= rest;
    const z = pBuy + pSell + pHold || 1;
    pBuy /= z;
    pSell /= z;
    pHold /= z;
  }

  if (
    state.lastSide &&
    state.lastSide !== "hold" &&
    side !== "hold" &&
    side !== state.lastSide
  ) {
    const incoming = side === "buy" ? pBuy : pSell;
    if (incoming < FLIP_THRESHOLD) {
      side = state.lastSide;
    }
  }

  let skipped = false;
  let skipReason: string | undefined;
  if (side === "hold") {
    skipped = true;
    skipReason = "hold";
  } else if (gate < GATE_THRESHOLD) {
    skipped = true;
    skipReason = "gate";
  }

  return {
    gate,
    side,
    pBuy,
    pSell,
    pHold,
    tradeNow: !skipped,
    skipped,
    skipReason,
  };
}
