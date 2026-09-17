"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { cn } from "@/lib/cn";
import type { LivelineFlags } from "@/lib/types";

const toggles: Array<{ key: keyof LivelineFlags; label: string; bool?: true }> = [
  { key: "grid", label: "Grid" },
  { key: "badge", label: "Badge" },
  { key: "badgeTail", label: "Badge tail" },
  { key: "fill", label: "Fill" },
  { key: "pulse", label: "Pulse" },
  { key: "momentum", label: "Momentum" },
  { key: "exaggerate", label: "Exaggerate" },
  { key: "showValue", label: "Show value" },
  { key: "valueMomentumColor", label: "Value color" },
  { key: "degen", label: "Degen" },
  { key: "degenDown", label: "Degen down" },
  { key: "scrub", label: "Scrub" },
  { key: "tooltipOutline", label: "Tooltip outline" },
  { key: "paused", label: "Paused" },
  { key: "loading", label: "Loading" },
  { key: "orderbook", label: "Orderbook overlay" },
  { key: "compareIndex", label: "Mark vs index" },
];

export function ChartSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { flags, setFlags } = useDesk();
  if (!open) return null;
  return (
    <div className="absolute right-3 top-12 z-30 w-[320px] rounded-xl border border-white/8 bg-[#141414]/95 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between text-[12px] text-white/50">
        <span>Liveline</span>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {toggles.map((t) => {
          const on = Boolean(flags[t.key]);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFlags({ [t.key]: !on })}
              className={cn(
                "rounded-lg px-2 py-1.5 text-left text-[12px] motion-safe:active:scale-[0.97]",
                on ? "bg-white/12 text-white" : "bg-white/4 text-white/45",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2 text-[12px] text-white/55">
        <label className="flex items-center justify-between gap-2">
          Line width
          <input
            type="range"
            min={1}
            max={4}
            step={0.5}
            value={flags.lineWidth}
            onChange={(e) => setFlags({ lineWidth: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          Lerp {flags.lerpSpeed.toFixed(2)}
          <input
            type="range"
            min={0.04}
            max={0.4}
            step={0.02}
            value={flags.lerpSpeed}
            onChange={(e) => setFlags({ lerpSpeed: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          Degen scale
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={flags.degenScale}
            onChange={(e) => setFlags({ degenScale: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          Badge
          <select
            className="rounded bg-white/8 px-2 py-1"
            value={flags.badgeVariant}
            onChange={(e) =>
              setFlags({ badgeVariant: e.target.value as LivelineFlags["badgeVariant"] })
            }
          >
            <option value="default">Default</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          Windows
          <select
            className="rounded bg-white/8 px-2 py-1"
            value={flags.windowStyle}
            onChange={(e) =>
              setFlags({ windowStyle: e.target.value as LivelineFlags["windowStyle"] })
            }
          >
            <option value="default">Default</option>
            <option value="rounded">Rounded</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          Reference
          <select
            className="rounded bg-white/8 px-2 py-1"
            value={flags.reference}
            onChange={(e) =>
              setFlags({ reference: e.target.value as LivelineFlags["reference"] })
            }
          >
            <option value="none">None</option>
            <option value="entry">Entry</option>
            <option value="liq">Liq</option>
          </select>
        </label>
      </div>
    </div>
  );
}
