"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { usd } from "@/lib/format";

const TICKS = Array.from({ length: 48 }, (_, i) => {
  const a = (-220 + (i / 47) * 260) * (Math.PI / 180);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    x1: r(84 + Math.cos(a) * 62),
    y1: r(84 + Math.sin(a) * 62),
    x2: r(84 + Math.cos(a) * 74),
    y2: r(84 + Math.sin(a) * 74),
  };
});

export function ProfitGauge() {
  const { account, uPnL } = useDesk();
  const realized = account.realizedPnl;
  const unreal = uPnL;
  const total = realized + unreal;
  const mag = Math.max(Math.abs(realized) + Math.abs(unreal), 1);
  const rFrac = Math.abs(realized) / mag;

  return (
    <section className="rounded-2xl border border-white/6 bg-[#111] px-5 py-5">
      <div className="relative mx-auto h-[168px] w-[168px]">
        <svg viewBox="0 0 168 168" className="h-full w-full">
          {TICKS.map((t, i) => {
            const on = i < Math.max(3, Math.round(rFrac * TICKS.length));
            return (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={on ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.12)"}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[11px] text-white/40">Profit</div>
          <div className="text-[18px] font-medium tracking-tight">
            {usd(total, 2)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-white/80" /> Realized {usd(realized, 2)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-white/25" /> Unrealized {usd(unreal, 2)}
        </span>
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-full bg-white/8 py-2 text-[13px] text-white/80 motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.97]"
        onClick={() => document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth" })}
      >
        View Detail →
      </button>
    </section>
  );
}
