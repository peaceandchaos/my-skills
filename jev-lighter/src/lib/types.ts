import type {
  BadgeVariant,
  DegenOptions,
  WindowStyle,
} from "liveline";

export type ExecMode = "advisory" | "paper" | "live";
export type Side = "buy" | "sell";
export type JevSide = "buy" | "sell" | "hold";
export type OrderType = "market" | "limit";
export type ChartMode = "line" | "candle";
export type WsStatus = "connecting" | "live" | "down";

export type LighterMarket = {
  marketId: number;
  symbol: string;
  status: string;
  marketType: string;
  markPrice: number;
  indexPrice: number;
  lastTradePrice: number;
  volumeQuote: number;
  trades: number;
  minQuote: number;
  minBase: number;
  sizeDecimals: number;
  priceDecimals: number;
  takerFee: number;
  makerFee: number;
  minImf: number;
  mmf: number;
  fundingClampSmall: number;
};

export type MarketStats = {
  marketId: number;
  symbol: string;
  markPrice: number;
  indexPrice: number;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  fundingRate: number;
  currentFundingRate: number;
  fundingTimestamp: number;
  openInterest: number;
  dailyChange: number;
};

export type Position = {
  marketId: number;
  symbol: string;
  sign: 1 | -1;
  base: number;
  avgEntry: number;
  leverage: number;
  margin: number;
  openedAt: number;
  sl?: number;
  tp?: number;
};

export type Fill = {
  id: string;
  at: number;
  marketId: number;
  symbol: string;
  side: Side;
  type: OrderType;
  base: number;
  price: number;
  mark: number;
  notional: number;
  fee: number;
  feeBps: number;
  slipBps: number;
  reduceOnly: boolean;
  status: "filled" | "partial" | "canceled";
  source: "ticket" | "jev" | "sl" | "tp" | "liq" | "flatten";
};

export type RestingOrder = {
  id: string;
  marketId: number;
  symbol: string;
  side: Side;
  type: "limit";
  limitPrice: number;
  quoteUsd: number;
  leverage: number;
  reduceOnly: boolean;
  sl?: number;
  tp?: number;
  createdAt: number;
};

export type ClosedTrade = {
  at: number;
  marketId: number;
  symbol: string;
  pnl: number;
  notional: number;
  win: boolean;
};

export type JevPending = {
  at: number;
  side: Exclude<JevSide, "hold">;
  mark: number;
  marketId: number;
  resolveAt: number;
};

export type Account = {
  cash: number;
  startingCash: number;
  positions: Position[];
  fills: Fill[];
  orders: RestingOrder[];
  closed: ClosedTrade[];
  realizedPnl: number;
  jevCalls: number;
  jevHits: number;
  jevResolved: number;
  pending: JevPending[];
};

export type JevVerdict = {
  at: number;
  marketId: number;
  symbol: string;
  gate: number;
  side: JevSide;
  pBuy: number;
  pSell: number;
  pHold: number;
  tradeNow: boolean;
  skipped: boolean;
  skipReason?: string;
  latencyMs: number;
  executed: boolean;
};

export type TicketState = {
  side: Side;
  type: OrderType;
  quoteUsd: number;
  leverage: number;
  limitPrice: string;
  sl: string;
  tp: string;
  reduceOnly: boolean;
};

export type LivelineFlags = {
  grid: boolean;
  badge: boolean;
  badgeTail: boolean;
  badgeVariant: BadgeVariant;
  fill: boolean;
  pulse: boolean;
  momentum: boolean;
  exaggerate: boolean;
  showValue: boolean;
  valueMomentumColor: boolean;
  degen: boolean;
  degenScale: number;
  degenDown: boolean;
  loading: boolean;
  paused: boolean;
  scrub: boolean;
  tooltipOutline: boolean;
  windowStyle: WindowStyle;
  lineWidth: number;
  lerpSpeed: number;
  orderbook: boolean;
  compareIndex: boolean;
  reference: "none" | "entry" | "liq";
};

export type DegenConfig = boolean | DegenOptions;
