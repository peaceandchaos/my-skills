"use client";

import { MAX_LEVERAGE, useDesk } from "@/components/desk/DeskProvider";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_ORDER_USD } from "@/lib/lighter/config";
import type { OrderType, Side } from "@/lib/types";

export function OrderTicket() {
  const { ticket, setTicket, submitTicket, lastError, market, execMode } = useDesk();
  const maxLev = Math.min(
    MAX_LEVERAGE,
    market ? Math.floor(10000 / Math.max(market.minImf, 1)) : MAX_LEVERAGE,
  );

  return (
    <DashboardCard className="gap-4" id="ticket">
      <div className="flex items-center justify-between">
        <DashboardCardTitle>Ticket</DashboardCardTitle>
        <span className="text-muted-foreground text-xs">
          {execMode === "live" ? "Live (paper fallback)" : execMode}
        </span>
      </div>
      <ToggleGroup
        className="w-full"
        onValueChange={(v) => {
          if (v) setTicket({ side: v as Side });
        }}
        spacing={0}
        type="single"
        value={ticket.side}
        variant="outline"
      >
        <ToggleGroupItem
          className="flex-1 capitalize data-[state=on]:bg-emerald-500/15 data-[state=on]:text-emerald-400"
          value="buy"
        >
          Buy
        </ToggleGroupItem>
        <ToggleGroupItem
          className="flex-1 capitalize data-[state=on]:bg-rose-500/15 data-[state=on]:text-rose-400"
          value="sell"
        >
          Sell
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        className="w-full"
        onValueChange={(v) => {
          if (v) setTicket({ type: v as OrderType });
        }}
        spacing={0}
        type="single"
        value={ticket.type}
        variant="outline"
      >
        <ToggleGroupItem className="flex-1 capitalize" value="market">
          Market
        </ToggleGroupItem>
        <ToggleGroupItem className="flex-1 capitalize" value="limit">
          Limit
        </ToggleGroupItem>
      </ToggleGroup>
      <label className="flex flex-col gap-1.5 text-muted-foreground text-xs">
        Size USDC
        <Input
          min={market?.minQuote ?? 10}
          onChange={(e) => setTicket({ quoteUsd: Number(e.target.value) || DEFAULT_ORDER_USD })}
          step={1}
          type="number"
          value={ticket.quoteUsd}
        />
      </label>
      <label className="flex flex-col gap-2 text-muted-foreground text-xs">
        Leverage {ticket.leverage}x isolated
        <Slider
          max={maxLev}
          min={1}
          onValueChange={(v) => setTicket({ leverage: v[0] ?? ticket.leverage })}
          step={1}
          value={[ticket.leverage]}
        />
      </label>
      {ticket.type === "limit" ? (
        <label className="flex flex-col gap-1.5 text-muted-foreground text-xs">
          Limit
          <Input
            onChange={(e) => setTicket({ limitPrice: e.target.value })}
            value={ticket.limitPrice}
          />
        </label>
      ) : null}
      <details
        className="group"
        open={Boolean(ticket.sl || ticket.tp || ticket.reduceOnly)}
      >
        <summary className="cursor-pointer text-muted-foreground text-xs">
          Stops and reduce-only
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5 text-muted-foreground text-xs">
            SL
            <Input onChange={(e) => setTicket({ sl: e.target.value })} value={ticket.sl} />
          </label>
          <label className="flex flex-col gap-1.5 text-muted-foreground text-xs">
            TP
            <Input onChange={(e) => setTicket({ tp: e.target.value })} value={ticket.tp} />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <Checkbox
            checked={ticket.reduceOnly}
            onCheckedChange={(v) => setTicket({ reduceOnly: v === true })}
          />
          Reduce only
        </label>
      </details>
      {lastError ? <div className="text-amber-500 text-xs">{lastError}</div> : null}
      <Button
        className="w-full"
        onClick={() => submitTicket()}
        variant={ticket.side === "buy" ? "default" : "destructive"}
      >
        {ticket.side === "buy" ? "Buy" : "Sell"} {market?.symbol ?? ""}
      </Button>
    </DashboardCard>
  );
}
