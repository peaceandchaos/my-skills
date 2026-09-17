import { LIGHTER_REST } from "@/lib/lighter/config";
import type { CandlePoint } from "liveline";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const marketId = url.searchParams.get("market_id");
  const resolution = url.searchParams.get("resolution") ?? "1m";
  if (!marketId) {
    return Response.json({ error: "market_id required" }, { status: 400 });
  }
  const now = Date.now();
  const hours = resolution === "1m" ? 8 : 48;
  const start = now - hours * 60 * 60 * 1000;
  const upstream = new URL(`${LIGHTER_REST}/api/v1/candles`);
  upstream.searchParams.set("market_id", marketId);
  upstream.searchParams.set("resolution", resolution);
  upstream.searchParams.set("start_timestamp", String(start));
  upstream.searchParams.set("end_timestamp", String(now));
  upstream.searchParams.set("count_back", "500");
  const res = await fetch(upstream, { next: { revalidate: 5 } });
  if (!res.ok) {
    return Response.json({ error: "candles failed" }, { status: 502 });
  }
  const data = (await res.json()) as {
    c?: Array<{ t: number; o: number; h: number; l: number; c: number }>;
  };
  const candles: CandlePoint[] = (data.c ?? []).map((c) => ({
    time: Math.floor(c.t / 1000),
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
  return Response.json({ candles });
}
