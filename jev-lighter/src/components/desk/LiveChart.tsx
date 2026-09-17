"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Liveline, type CandlePoint, type HoverPoint, type ReferenceLine } from "liveline";
import { ChartSettings } from "@/components/desk/ChartSettings";
import { CANDLE_WINDOWS, LINE_WINDOWS, liqPrice, useDesk } from "@/components/desk/DeskProvider";
import { TvTooltip } from "@/components/desk/TvTooltip";
import { compactUsd, fmtPct, fmtPrice, usd } from "@/lib/format";

export function LiveChart() {
  const desk = useDesk();
  const [settings, setSettings] = useState(false);
  const {
    line,
    indexLine,
    flags,
    chartMode,
    setChartMode,
    windowSecs,
    setWindowSecs,
    candles,
    liveCandle,
    candleWidth,
    mark,
    market,
    hover,
    setHover,
    orderbook,
    reducedMotion,
    eq,
    uPnL,
    currentPos,
    stats,
    marketId,
  } = desk;

  const value = line[line.length - 1]?.value ?? mark;
  const windows = chartMode === "candle" ? CANDLE_WINDOWS : LINE_WINDOWS;
  const change = market
    ? (stats[marketId]?.dailyChange ?? 0) / 100
    : 0;

  const reference: ReferenceLine | undefined = useMemo(() => {
    if (!currentPos) return undefined;
    if (flags.reference === "entry") {
      return { value: currentPos.avgEntry, label: "Entry" };
    }
    if (flags.reference === "liq" && market) {
      return { value: liqPrice(currentPos, market.mmf), label: "Liq" };
    }
    return undefined;
  }, [currentPos, flags.reference, market]);

  const [localHover, setLocalHover] = useState<HoverPoint | null>(null);
  const tip = localHover ?? hover;

  function onChartMove(e: MouseEvent<HTMLDivElement>) {
    if (!line.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const padL = 52;
    const padR = 16;
    const chartW = Math.max(1, rect.width - padL - padR);
    const frac = Math.min(1, Math.max(0, (x - padL) / chartW));
    const tEnd = line[line.length - 1].time;
    const tStart = tEnd - windowSecs;
    const t = tStart + frac * windowSecs;
    let best = line[0];
    let dist = Math.abs(best.time - t);
    for (const p of line) {
      const d = Math.abs(p.time - t);
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    setLocalHover({ time: best.time, value: best.value, x, y });
  }

  const hoverCandle: CandlePoint | undefined = useMemo(() => {
    if (chartMode !== "candle" || !tip) return undefined;
    const all = liveCandle ? candles.concat(liveCandle) : candles;
    let best: CandlePoint | undefined;
    let dist = Infinity;
    for (const c of all) {
      const d = Math.abs(c.time - tip.time);
      if (d < dist) {
        dist = d;
        best = c;
      }
    }
    return dist <= candleWidth * 1.5 ? best : undefined;
  }, [chartMode, tip, candles, liveCandle, candleWidth]);

  const series = flags.compareIndex
    ? [
        {
          id: "mark",
          label: "Mark",
          color: "#e5e5e5",
          data: line,
          value,
        },
        {
          id: "index",
          label: "Index",
          color: "#60a5fa",
          data: indexLine,
          value: indexLine[indexLine.length - 1]?.value ?? value,
        },
      ]
    : undefined;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#111] p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-white/45">Wallet</div>
          <div className="text-[34px] font-medium tracking-tight">{compactUsd(eq)}</div>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className={change >= 0 ? "text-emerald-400" : "text-red-400"}>
            {change >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(change), 1)} 24h
          </span>
          <span className={uPnL >= 0 ? "text-emerald-400" : "text-red-400"}>
            {uPnL >= 0 ? "+" : ""}
            {usd(uPnL, 2)} pos
          </span>
          <button
            type="button"
            onClick={() => setSettings((v) => !v)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-white/60 motion-safe:active:scale-[0.97]"
          >
            Chart
          </button>
        </div>
      </div>
      <div
        className="relative h-[320px] md:h-[360px]"
        onMouseMove={onChartMove}
        onMouseLeave={() => setLocalHover(null)}
      >
        <Liveline
          data={line}
          value={value}
          series={series}
          theme="dark"
          color="#d4d4d4"
          window={windowSecs}
          windows={windows}
          onWindowChange={setWindowSecs}
          windowStyle={flags.windowStyle}
          grid={flags.grid}
          badge={flags.badge}
          badgeTail={flags.badgeTail}
          badgeVariant={flags.badgeVariant}
          fill={flags.fill}
          pulse={flags.pulse}
          momentum={flags.momentum}
          exaggerate={flags.exaggerate}
          showValue={flags.showValue}
          valueMomentumColor={flags.valueMomentumColor}
          degen={
            flags.degen
              ? { scale: flags.degenScale, downMomentum: flags.degenDown }
              : false
          }
          loading={flags.loading}
          paused={flags.paused}
          scrub={flags.scrub}
          tooltipOutline={flags.tooltipOutline}
          tooltipY={18}
          lineWidth={flags.lineWidth}
          lerpSpeed={reducedMotion ? 1 : flags.lerpSpeed}
          orderbook={orderbook}
          referenceLine={reference}
          mode={candles.length || liveCandle ? "candle" : "line"}
          candles={candles}
          liveCandle={liveCandle}
          candleWidth={candleWidth}
          lineMode={chartMode === "line"}
          lineData={line}
          lineValue={value}
          onModeChange={setChartMode}
          onHover={setHover}
          formatValue={(v) => fmtPrice(v, market?.priceDecimals ?? 2)}
          emptyText="Waiting for Lighter"
        />
        <TvTooltip
          hover={tip}
          candle={hoverCandle}
          decimals={market?.priceDecimals ?? 2}
          symbol={market?.symbol ?? ""}
        />
        <ChartSettings open={settings} onClose={() => setSettings(false)} />
      </div>
    </section>
  );
}
