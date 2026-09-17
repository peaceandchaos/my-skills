"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { compactUsd, fmtPrice } from "@/lib/format";
import { useDesk } from "@/components/desk/DeskProvider";

export function MarketPicker() {
  const { markets, market, marketId, setMarketId, stats } = useDesk();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = markets.filter((m) =>
      query ? m.symbol.toLowerCase().includes(query) : true,
    );
    return list.slice(0, query ? 40 : 25);
  }, [markets, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm motion-safe:active:scale-[0.97] motion-safe:transition-transform motion-safe:duration-150"
      >
        <span className="font-medium">{market?.symbol ?? "…"}</span>
        <span className="text-white/40">
          {market ? fmtPrice(stats[marketId]?.markPrice || market.markPrice, market.priceDecimals) : ""}
        </span>
        <span className="text-white/30">▾</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-xl border border-white/8 bg-[#141414] shadow-2xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Lighter perps"
            className="w-full border-b border-white/8 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/30"
          />
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.map((m) => {
              const live = stats[m.marketId];
              return (
                <button
                  key={m.marketId}
                  type="button"
                  onClick={() => {
                    setMarketId(m.marketId);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5",
                    m.marketId === marketId && "bg-white/8",
                  )}
                >
                  <span>
                    <span className="font-medium">{m.symbol}</span>
                    <span className="ml-2 text-[11px] text-white/35">
                      {compactUsd(live?.markPrice ? m.volumeQuote : m.volumeQuote)} vol
                    </span>
                  </span>
                  <span className="font-mono text-xs text-white/60">
                    {fmtPrice(live?.markPrice || m.markPrice, m.priceDecimals)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
