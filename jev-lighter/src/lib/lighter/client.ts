import { LIGHTER_REST, candleSpec, type CandleResolution } from "./config";
import { parseMarket } from "./parse";
import type { LighterMarket } from "@/lib/types";
import type { CandlePoint } from "liveline";

export async function fetchMarkets(): Promise<LighterMarket[]> {
  const res = await fetch(`${LIGHTER_REST}/api/v1/orderBookDetails`);
  if (!res.ok) throw new Error("markets failed");
  const data = (await res.json()) as {
    order_book_details?: Record<string, unknown>[];
  };
  return (data.order_book_details ?? [])
    .filter(
      (m) =>
        String(m.status) === "active" && String(m.market_type ?? "perp") === "perp",
    )
    .map(parseMarket)
    .sort((a, b) => b.volumeQuote - a.volumeQuote);
}

export async function fetchCandles(
  marketId: number,
  resolution: CandleResolution,
  windowSecs: number,
): Promise<CandlePoint[]> {
  const { candleWidth } = candleSpec(windowSecs);
  const now = Date.now();
  const spanMs = Math.max(windowSecs * 4, candleWidth * 24) * 1000;
  const start = now - spanMs;
  const upstream = new URL(`${LIGHTER_REST}/api/v1/candles`);
  upstream.searchParams.set("market_id", String(marketId));
  upstream.searchParams.set("resolution", resolution);
  upstream.searchParams.set("start_timestamp", String(start));
  upstream.searchParams.set("end_timestamp", String(now));
  upstream.searchParams.set("count_back", "500");
  const res = await fetch(upstream);
  if (!res.ok) throw new Error("candles failed");
  const data = (await res.json()) as {
    c?: Array<{ t: number; o: number; h: number; l: number; c: number }>;
  };
  return (data.c ?? []).map((c) => ({
    time: Math.floor(c.t / 1000),
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
}

export function lighterRest() {
  return LIGHTER_REST;
}

export { parseMarket };
