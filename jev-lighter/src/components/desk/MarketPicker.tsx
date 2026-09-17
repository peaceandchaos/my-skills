"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { useDesk } from "@/components/desk/DeskProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { compactUsd, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          <span className="font-medium">{market?.symbol ?? "…"}</span>
          <span className="font-normal text-muted-foreground">
            {market
              ? fmtPrice(stats[marketId]?.markPrice || market.markPrice, market.priceDecimals)
              : ""}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Input
          autoFocus
          className="rounded-none border-0 border-b focus-visible:ring-0"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Lighter perps"
          value={q}
        />
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((m) => {
            const live = stats[m.marketId];
            return (
              <button
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                  m.marketId === marketId && "bg-muted",
                )}
                key={m.marketId}
                onClick={() => {
                  setMarketId(m.marketId);
                  setOpen(false);
                  setQ("");
                }}
                type="button"
              >
                <span>
                  <span className="font-medium">{m.symbol}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {compactUsd(m.volumeQuote)} vol
                  </span>
                </span>
                <span className="font-mono text-muted-foreground text-xs">
                  {fmtPrice(live?.markPrice || m.markPrice, m.priceDecimals)}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
