"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { Liveline, type CandlePoint, type HoverPoint, type ReferenceLine } from "liveline";
import { ChartSettings } from "@/components/desk/ChartSettings";
import { CANDLE_WINDOWS, LINE_WINDOWS, liqPrice, useDesk } from "@/components/desk/DeskProvider";
import { TvTooltip } from "@/components/desk/TvTooltip";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { compactUsd, fmtPrice } from "@/lib/format";

const LIVELINE_PAD_LEFT = 52;
const LIVELINE_PAD_RIGHT = 16;

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
    currentPos,
    stats,
    marketId,
    wsStatus,
  } = desk;

  const value = line[line.length - 1]?.value ?? mark;
  const windows = chartMode === "candle" ? CANDLE_WINDOWS : LINE_WINDOWS;
  const changePct = market ? (stats[marketId]?.dailyChange ?? 0) : 0;
  const hasSeries = line.length > 0 || candles.length > 0 || Boolean(liveCandle);
  const chartLoading = flags.loading && !hasSeries && wsStatus === "connecting";
  const emptyText =
    wsStatus === "down" ? "Lighter is down" : "Waiting for Lighter";

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
    const chartW = Math.max(1, rect.width - LIVELINE_PAD_LEFT - LIVELINE_PAD_RIGHT);
    const frac = Math.min(1, Math.max(0, (x - LIVELINE_PAD_LEFT) / chartW));
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
    <DashboardCard className="gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 md:pe-4">
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold text-2xl tabular-nums">
            {compactUsd(eq)}
          </span>
          <DashboardCardTitle>Wallet</DashboardCardTitle>
        </div>

        <div className="inline-flex items-center gap-2 text-xs">
          <Delta value={changePct}>
            <DeltaIcon filled variant="arrow" />
            <DeltaValue />
          </Delta>
          <span className="text-muted-foreground">24h</span>
          <Popover onOpenChange={setSettings} open={settings}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                Chart
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <ChartSettings />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div
        className="relative h-64 w-full md:h-80"
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
          loading={chartLoading}
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
          emptyText={emptyText}
        />
        <TvTooltip
          hover={tip}
          candle={hoverCandle}
          decimals={market?.priceDecimals ?? 2}
          symbol={market?.symbol ?? ""}
        />
      </div>
    </DashboardCard>
  );
}
