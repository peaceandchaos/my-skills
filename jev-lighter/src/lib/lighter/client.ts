import { LIGHTER_REST } from "@/lib/lighter/config";
import { parseMarket } from "@/lib/lighter/parse";
import type { LighterMarket } from "@/lib/types";
import type { CandlePoint } from "liveline";

export async function fetchMarkets(): Promise<LighterMarket[]> {
  const res = await fetch("/api/markets");
  if (!res.ok) throw new Error("markets failed");
  const data = (await res.json()) as { markets: LighterMarket[] };
  return data.markets;
}

export async function fetchCandles(
  marketId: number,
  resolution = "1m",
): Promise<CandlePoint[]> {
  const res = await fetch(
    `/api/candles?market_id=${marketId}&resolution=${encodeURIComponent(resolution)}`,
  );
  if (!res.ok) throw new Error("candles failed");
  const data = (await res.json()) as { candles: CandlePoint[] };
  return data.candles;
}

export function lighterRest() {
  return LIGHTER_REST;
}

export { parseMarket };
