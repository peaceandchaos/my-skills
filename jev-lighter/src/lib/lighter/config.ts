export const LIGHTER_REST = "https://mainnet.zklighter.elliot.ai";
export const LIGHTER_WS =
  "wss://mainnet.zklighter.elliot.ai/stream?encoding=json&readonly=true";

export const DEFAULT_MARKET_ID = 1;
export const STARTING_CASH = 100;
export const DEFAULT_ORDER_USD = 15;
export const MAX_LEVERAGE = 5;
export const JEV_INTERVAL_MS = 2000;
export const JEV_HORIZON_MS = 30_000;
export const FLIP_THRESHOLD = 0.62;
export const GATE_THRESHOLD = 0.55;
export const CHART_FLUSH_MS = 50;
export const LINE_CAP = 2400;
export const TICK_KEEP_SECS = 15 * 60;
export const PAPER_SLIP_BPS = [0.4, 2.2] as const;
export const MONTH_SECS = 30 * 24 * 3600;

export type CandleResolution =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "12h"
  | "1d";

export type DeskWindow = { label: string; secs: number };

export const DESK_WINDOWS: DeskWindow[] = [
  { label: "5m", secs: 300 },
  { label: "1m", secs: 60 },
  { label: "15m", secs: 900 },
  { label: "1h", secs: 3600 },
  { label: "Month", secs: MONTH_SECS },
];

export const LINE_WINDOWS = DESK_WINDOWS;
export const CANDLE_WINDOWS = DESK_WINDOWS;

export function candleSpec(windowSecs: number): {
  resolution: CandleResolution;
  candleWidth: number;
} {
  if (windowSecs <= 3600) return { resolution: "1m", candleWidth: 60 };
  if (windowSecs <= 4 * 3600) return { resolution: "5m", candleWidth: 300 };
  if (windowSecs <= 24 * 3600) return { resolution: "1h", candleWidth: 3600 };
  return { resolution: "1d", candleWidth: 86_400 };
}
