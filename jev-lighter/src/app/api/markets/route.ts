import { LIGHTER_REST } from "@/lib/lighter/config";
import { parseMarket } from "@/lib/lighter/parse";

export async function GET() {
  const res = await fetch(`${LIGHTER_REST}/api/v1/orderBookDetails`, {
    next: { revalidate: 20 },
  });
  if (!res.ok) {
    return Response.json({ error: "lighter markets failed" }, { status: 502 });
  }
  const data = (await res.json()) as {
    order_book_details?: Record<string, unknown>[];
  };
  const markets = (data.order_book_details ?? [])
    .filter(
      (m) =>
        String(m.status) === "active" && String(m.market_type ?? "perp") === "perp",
    )
    .map(parseMarket)
    .sort((a, b) => b.volumeQuote - a.volumeQuote);
  return Response.json({ markets });
}
