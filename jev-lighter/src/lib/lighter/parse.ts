import type { LighterMarket, MarketStats } from "@/lib/types";

function num(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function parseMarket(raw: Record<string, unknown>): LighterMarket {
  return {
    marketId: num(raw.market_id),
    symbol: String(raw.symbol ?? ""),
    status: String(raw.status ?? ""),
    marketType: String(raw.market_type ?? "perp"),
    markPrice: num(raw.mark_price),
    indexPrice: num(raw.index_price),
    lastTradePrice: num(raw.last_trade_price),
    volumeQuote: num(raw.daily_quote_token_volume),
    trades: num(raw.daily_trades_count),
    minQuote: num(raw.min_quote_amount, 10),
    minBase: num(raw.min_base_amount),
    sizeDecimals: num(raw.size_decimals, 4),
    priceDecimals: num(raw.price_decimals, 2),
    takerFee: num(raw.taker_fee),
    makerFee: num(raw.maker_fee),
    minImf: num(raw.min_initial_margin_fraction, 1000),
    mmf: num(raw.maintenance_margin_fraction, 600),
    fundingClampSmall: num(raw.funding_clamp_small),
  };
}

export function parseStats(
  raw: Record<string, unknown>,
  fallbackId?: number,
): MarketStats {
  return {
    marketId: num(raw.market_id, fallbackId ?? 0),
    symbol: String(raw.symbol ?? ""),
    markPrice: num(raw.mark_price),
    indexPrice: num(raw.index_price),
    midPrice: num(raw.mid_price),
    bestBid: num(raw.best_bid_price),
    bestAsk: num(raw.best_ask_price),
    lastTradePrice: num(raw.last_trade_price),
    fundingRate: num(raw.funding_rate ?? raw.current_funding_rate),
    currentFundingRate: num(raw.current_funding_rate),
    fundingTimestamp: num(raw.funding_timestamp),
    openInterest: num(raw.open_interest),
    dailyChange: num(raw.daily_price_change),
  };
}
