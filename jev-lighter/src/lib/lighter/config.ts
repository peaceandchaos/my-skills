export const LIGHTER_REST = "https://mainnet.zklighter.elliot.ai";
export const LIGHTER_WS =
  "wss://mainnet.zklighter.elliot.ai/stream?encoding=json&readonly=true";

export const DEFAULT_MARKET_ID = 1; // BTC — most liquid perp
export const STARTING_CASH = 100;
export const DEFAULT_ORDER_USD = 15;
export const MAX_LEVERAGE = 5;
export const JEV_INTERVAL_MS = 2000;
export const JEV_HORIZON_MS = 30_000;
export const FLIP_THRESHOLD = 0.62;
export const GATE_THRESHOLD = 0.55;
export const CHART_FLUSH_MS = 50;
export const LINE_CAP = 2400;
export const PAPER_SLIP_BPS = [0.4, 2.2] as const;

export const LINE_WINDOWS = [
  { label: "30s", secs: 30 },
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "15m", secs: 900 },
];

export const CANDLE_WINDOWS = [
  { label: "5m", secs: 300 },
  { label: "15m", secs: 900 },
  { label: "1h", secs: 3600 },
  { label: "4h", secs: 14_400 },
];
