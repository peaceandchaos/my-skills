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
    <div
      className="pointer-events-none absolute z-20 min-w-[168px] rounded-lg border border-white/10 bg-[#141414]/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-150"
      style={{
        left: Math.max(8, hover.x + 12),
        top: Math.max(8, hover.y - 12),
        opacity: 1,
      }}
    >
      <div className="flex items-center justify-between gap-4 text-white/45">
        <span>{symbol}</span>
        <span className="font-mono">{fmtTime(hover.time)}</span>
      </div>
      {ohlc ? (
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[12px]">
          <span className="text-white/40">O</span>
          <span>{fmtPrice(ohlc.open, decimals)}</span>
          <span className="text-white/40">H</span>
          <span className="text-emerald-400">{fmtPrice(ohlc.high, decimals)}</span>
          <span className="text-white/40">L</span>
          <span className="text-red-400">{fmtPrice(ohlc.low, decimals)}</span>
          <span className="text-white/40">C</span>
          <span>{fmtPrice(ohlc.close, decimals)}</span>
        </div>
      ) : (
        <div className="mt-1 font-mono text-[13px]">{fmtPrice(hover.value, decimals)}</div>
      )}
    </div>
  );
}
