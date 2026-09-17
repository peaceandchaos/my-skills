"use client";

import { liqPrice, useDesk } from "@/components/desk/DeskProvider";
import { fmtDate, fmtPrice, usd } from "@/lib/format";

export function PositionCard() {
  const { currentPos, market, mark, uPnL, lastFill } = useDesk();
  const pos = currentPos;
  if (!pos) {
    return (
      <section className="rounded-2xl border border-white/6 bg-[#111] px-5 py-5">
        <div className="text-[15px] font-medium">Open position</div>
        <div className="mt-6 text-[20px] text-white/35">Flat</div>
        {lastFill ? (
          <div className="mt-4 text-[13px] text-white/40">
            Last fill {lastFill.side.toUpperCase()} {usd(lastFill.notional)} @{" "}
            {fmtPrice(lastFill.price, market?.priceDecimals ?? 2)}
          </div>
        ) : (
          <div className="mt-4 text-[13px] text-white/35">No fills this session</div>
        )}
      </section>
    );
  }
  const liq = market ? liqPrice(pos, market.mmf) : 0;
  const side = pos.sign === 1 ? "Long" : "Short";
  return (
    <section className="rounded-2xl border border-white/6 bg-[#111] px-5 py-5">
      <div className="text-[15px] font-medium">Open position</div>
      <dl className="mt-4 space-y-2 text-[13px]">
        <Row k="Market" v={pos.symbol} />
        <Row k="Side" v={`${side} ${pos.leverage}x isolated`} />
        <Row k="Size" v={`${pos.base.toPrecision(4)} · ${usd(pos.base * (mark || pos.avgEntry))}`} />
        <Row k="Entry" v={fmtPrice(pos.avgEntry, market?.priceDecimals ?? 2)} />
        <Row k="Mark" v={fmtPrice(mark || pos.avgEntry, market?.priceDecimals ?? 2)} />
        <Row k="Liq" v={fmtPrice(liq, market?.priceDecimals ?? 2)} />
        <Row k="Opened" v={fmtDate(pos.openedAt)} />
        <Row k="uPnL" v={usd(uPnL, 2)} />
        <Row k="Margin" v={usd(pos.margin, 2)} />
        <div className="flex items-center justify-between pt-1">
          <dt className="text-white/45">Status</dt>
          <dd>
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[12px]">Open</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/45">{k}</dt>
      <dd className="font-mono text-[13px]">{v}</dd>
    </div>
  );
}
