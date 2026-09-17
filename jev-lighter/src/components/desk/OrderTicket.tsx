"use client";

import { MAX_LEVERAGE, useDesk } from "@/components/desk/DeskProvider";
import { cn } from "@/lib/cn";
import { DEFAULT_ORDER_USD } from "@/lib/lighter/config";

export function OrderTicket() {
  const { ticket, setTicket, submitTicket, lastError, market, execMode } = useDesk();
  const maxLev = Math.min(
    MAX_LEVERAGE,
    market ? Math.floor(10000 / Math.max(market.minImf, 1)) : MAX_LEVERAGE,
  );

  return (
    <section id="ticket" className="rounded-2xl border border-white/6 bg-[#111] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-medium">Ticket</div>
        <div className="text-[11px] text-white/35">
          {execMode === "live" ? "Live (paper fallback)" : execMode}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTicket({ side: s })}
            className={cn(
              "rounded-full py-1.5 text-[13px] capitalize motion-safe:active:scale-[0.97]",
              ticket.side === s
                ? s === "buy"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
                : "text-white/45",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1">
        {(["market", "limit"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTicket({ type: s })}
            className={cn(
              "rounded-full py-1.5 text-[13px] capitalize motion-safe:active:scale-[0.97]",
              ticket.type === s ? "bg-white/12 text-white" : "text-white/45",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[12px] text-white/40">
        Size USDC
        <input
          type="number"
          min={market?.minQuote ?? 10}
          step={1}
          value={ticket.quoteUsd}
          onChange={(e) => setTicket({ quoteUsd: Number(e.target.value) || DEFAULT_ORDER_USD })}
          className="mt-1 w-full rounded-lg border border-white/8 bg-transparent px-3 py-2 text-[14px] text-white outline-none"
        />
      </label>
      <label className="mt-2 block text-[12px] text-white/40">
        Leverage {ticket.leverage}x isolated
        <input
          type="range"
          min={1}
          max={maxLev}
          step={1}
          value={ticket.leverage}
          onChange={(e) => setTicket({ leverage: Number(e.target.value) })}
          className="mt-2 w-full"
        />
      </label>
      {ticket.type === "limit" ? (
        <label className="mt-2 block text-[12px] text-white/40">
          Limit
          <input
            value={ticket.limitPrice}
            onChange={(e) => setTicket({ limitPrice: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/8 bg-transparent px-3 py-2 text-[14px] outline-none"
          />
        </label>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[12px] text-white/40">
          SL
          <input
            value={ticket.sl}
            onChange={(e) => setTicket({ sl: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/8 bg-transparent px-3 py-2 text-[14px] outline-none"
          />
        </label>
        <label className="text-[12px] text-white/40">
          TP
          <input
            value={ticket.tp}
            onChange={(e) => setTicket({ tp: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/8 bg-transparent px-3 py-2 text-[14px] outline-none"
          />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-white/55">
        <input
          type="checkbox"
          checked={ticket.reduceOnly}
          onChange={(e) => setTicket({ reduceOnly: e.target.checked })}
        />
        Reduce only
      </label>
      {lastError ? (
        <div className="mt-2 text-[12px] text-amber-300">{lastError}</div>
      ) : null}
      <button
        type="button"
        onClick={() => submitTicket()}
        className={cn(
          "mt-4 w-full rounded-full py-2.5 text-[14px] font-medium motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.97]",
          ticket.side === "buy" ? "bg-emerald-500/90 text-black" : "bg-red-500/90 text-white",
        )}
      >
        {ticket.side === "buy" ? "Buy" : "Sell"} {market?.symbol ?? ""}
      </button>
    </section>
  );
}
