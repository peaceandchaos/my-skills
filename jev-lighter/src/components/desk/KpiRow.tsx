"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { fmtPct, usd } from "@/lib/format";
import { cn } from "@/lib/cn";

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[#111] px-5 py-4">
      <div className="text-[13px] text-white/45">{label}</div>
      <div className="mt-1 text-[28px] font-medium tracking-tight">{value}</div>
      <div
        className={cn(
          "mt-2 text-[12px]",
          tone === "up" && "text-emerald-400",
          tone === "down" && "text-red-400",
          (!tone || tone === "neutral") && "text-white/40",
        )}
      >
        {hint}
      </div>
    </div>
  );
}

export function KpiRow() {
  const { account } = useDesk();
  const closed = account.closed.length;
  const wins = account.closed.filter((t) => t.win).length;
  const winRate = closed ? wins / closed : 0;
  const notional = account.fills.reduce((s, f) => s + f.notional, 0);
  const orders = account.fills.length;
  const aov = orders ? notional / orders : 0;
  const jevHit = account.jevResolved ? account.jevHits / account.jevResolved : 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile
        label="Win rate"
        value={closed ? fmtPct(winRate, 1) : "—"}
        hint={
          closed
            ? `${wins}W / ${closed - wins}L session · Jev hit ${fmtPct(jevHit, 0)}`
            : "Session round-trips · Jev horizon in vitals"
        }
        tone={closed ? (winRate >= 0.5 ? "up" : "down") : "neutral"}
      />
      <Tile
        label="Orders"
        value={orders.toLocaleString()}
        hint="All-time this session"
        tone={orders ? "up" : "neutral"}
      />
      <Tile
        label="Average order value"
        value={orders ? usd(aov, 2) : "—"}
        hint="All-time this session"
        tone="neutral"
      />
    </div>
  );
}
