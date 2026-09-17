"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { cn } from "@/lib/cn";
import { fmtPct } from "@/lib/format";

export function JevStance() {
  const { jev } = useDesk();
  const side = jev?.side ?? "hold";
  const pBuy = jev?.pBuy ?? 0;
  const pSell = jev?.pSell ?? 0;
  const pHold = jev?.pHold ?? 1;
  const conv = Math.max(pBuy, pSell, pHold);
  return (
    <section className="rounded-2xl border border-white/6 bg-[#111] px-5 py-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[13px] text-white/45">Jev stance</div>
          <div className="mt-1 text-[28px] font-medium tracking-tight uppercase">
            {side}
          </div>
        </div>
        <div className="text-right text-[12px] text-white/40">
          {jev ? `${Math.round(conv * 100)}%` : "waiting"}
          <div>
            {jev?.skipped
              ? `skip · ${jev.skipReason}`
              : jev?.executed
                ? "fired"
                : jev
                  ? "armed"
                  : ""}
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-7 overflow-hidden rounded-sm">
        <div className="bg-emerald-500/80" style={{ width: `${pBuy * 100}%` }} />
        <div className="bg-white/15" style={{ width: `${pHold * 100}%` }} />
        <div className="bg-red-500/80" style={{ width: `${pSell * 100}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-white/40">
        <span>Buy {fmtPct(pBuy, 0)}</span>
        <span>Hold {fmtPct(pHold, 0)}</span>
        <span>Sell {fmtPct(pSell, 0)}</span>
        <span className={cn(jev?.tradeNow ? "text-emerald-400" : "text-white/35")}>
          gate {jev ? fmtPct(jev.gate, 0) : "—"}
        </span>
      </div>
    </section>
  );
}
