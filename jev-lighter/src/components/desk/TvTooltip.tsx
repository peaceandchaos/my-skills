"use client";

import type { CandlePoint, HoverPoint } from "liveline";
import { fmtPrice, fmtTime } from "@/lib/format";

export function TvTooltip({
  hover,
  candle,
  decimals,
  symbol,
}: {
  hover: HoverPoint | null;
  candle?: CandlePoint;
  decimals: number;
  symbol: string;
}) {
  if (!hover) return null;
  const ohlc = candle;
  return (
    <div className="pointer-events-none absolute top-12 left-3 z-20 min-w-[196px] rounded-lg bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>{symbol}</span>
        <span className="font-mono">{fmtTime(hover.time)}</span>
      </div>
      {ohlc ? (
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
          <span className="text-muted-foreground">O</span>
          <span>{fmtPrice(ohlc.open, decimals)}</span>
          <span className="text-muted-foreground">H</span>
          <span className="text-emerald-400">{fmtPrice(ohlc.high, decimals)}</span>
          <span className="text-muted-foreground">L</span>
          <span className="text-rose-400">{fmtPrice(ohlc.low, decimals)}</span>
          <span className="text-muted-foreground">C</span>
          <span>{fmtPrice(ohlc.close, decimals)}</span>
        </div>
      ) : (
        <div className="mt-1 font-mono text-sm">{fmtPrice(hover.value, decimals)}</div>
      )}
    </div>
  );
}
