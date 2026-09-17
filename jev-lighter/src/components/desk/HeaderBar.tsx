"use client";

import { MarketPicker } from "@/components/desk/MarketPicker";
import { ModeSwitch } from "@/components/desk/ModeSwitch";
import { useDesk } from "@/components/desk/DeskProvider";
import { cn } from "@/lib/cn";

export function HeaderBar() {
  const { wsStatus, flatten, currentPos } = useDesk();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-[15px] font-medium tracking-tight">Jev · Lighter</div>
        <MarketPicker />
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[12px] text-white/45",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              wsStatus === "live" && "bg-emerald-400",
              wsStatus === "connecting" && "bg-amber-400",
              wsStatus === "down" && "bg-red-400",
            )}
          />
          {wsStatus === "live" ? "Lighter mark" : wsStatus}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ModeSwitch />
        <button
          type="button"
          onClick={flatten}
          disabled={!currentPos}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[13px] text-white/80 motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:active:scale-[0.97] disabled:opacity-30"
        >
          Flatten
        </button>
      </div>
    </header>
  );
}
