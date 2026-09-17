"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { fmtBps, fmtMs } from "@/lib/format";
import { cn } from "@/lib/cn";

function Vital({
  kicker,
  label,
  value,
  hint,
  good,
}: {
  kicker: string;
  label: string;
  value: string;
  hint: string;
  good?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/35">{kicker}</div>
      <div className="text-[13px] text-white/45">{label}</div>
      <div className="mt-1 text-[28px] font-medium tracking-tight">{value}</div>
      <div className={cn("mt-1 text-[12px]", good ? "text-emerald-400" : "text-white/40")}>
        {hint}
      </div>
    </div>
  );
}

export function Vitals() {
  const { lastLatency, lastFeeBps, lastSlipBps, account } = useDesk();
  const jevHit = account.jevResolved ? account.jevHits / account.jevResolved : 0;
  return (
    <section className="rounded-2xl border border-white/6 bg-[#111] px-5 py-4">
      <div className="mb-4">
        <div className="text-[15px] font-medium">Session vitals</div>
        <div className="text-[13px] text-white/40">
          Jev, fees, and fills — measured on this origin.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Vital
          kicker="Jev"
          label="Decision latency"
          value={lastLatency ? fmtMs(lastLatency) : "—"}
          hint={
            account.jevResolved
              ? `${Math.round(jevHit * 100)}% hit at 30s horizon`
              : "Round-trip to /api/jev"
          }
          good={lastLatency > 0 && lastLatency < 250}
        />
        <Vital
          kicker="Fill"
          label="Fee"
          value={fmtBps(lastFeeBps)}
          hint="Last fill · Lighter taker"
        />
        <Vital
          kicker="Fill"
          label="Slippage"
          value={fmtBps(lastSlipBps)}
          hint="Last fill vs mark"
          good={lastSlipBps > 0 && lastSlipBps < 2}
        />
      </div>
    </section>
  );
}
