"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import type { LivelineFlags } from "@/lib/types";

const toggles: Array<{ key: keyof LivelineFlags; label: string }> = [
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

export function ChartSettings() {
  const { flags, setFlags } = useDesk();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">Liveline</p>
      <div className="grid grid-cols-2 gap-1.5">
        {toggles.map((t) => {
          const on = Boolean(flags[t.key]);
          return (
            <Toggle
              aria-pressed={on}
              className="justify-start"
              key={t.key}
              onPressedChange={() => setFlags({ [t.key]: !on })}
              pressed={on}
              size="sm"
              variant="outline"
            >
              {t.label}
            </Toggle>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 text-muted-foreground text-xs">
        <label className="flex flex-col gap-2">
          Line width
          <Slider
            max={4}
            min={1}
            onValueChange={(v) => setFlags({ lineWidth: v[0] ?? flags.lineWidth })}
            step={0.5}
            value={[flags.lineWidth]}
          />
        </label>
        <label className="flex flex-col gap-2">
          Lerp {flags.lerpSpeed.toFixed(2)}
          <Slider
            max={0.4}
            min={0.04}
            onValueChange={(v) => setFlags({ lerpSpeed: v[0] ?? flags.lerpSpeed })}
            step={0.02}
            value={[flags.lerpSpeed]}
          />
        </label>
        <label className="flex flex-col gap-2">
          Degen scale
          <Slider
            max={4}
            min={0.5}
            onValueChange={(v) => setFlags({ degenScale: v[0] ?? flags.degenScale })}
            step={0.5}
            value={[flags.degenScale]}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          Badge
          <Select
            onValueChange={(v) =>
              setFlags({ badgeVariant: v as LivelineFlags["badgeVariant"] })
            }
            value={flags.badgeVariant}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          Windows
          <Select
            onValueChange={(v) =>
              setFlags({ windowStyle: v as LivelineFlags["windowStyle"] })
            }
            value={flags.windowStyle}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="rounded">Rounded</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          Reference
          <Select
            onValueChange={(v) =>
              setFlags({ reference: v as LivelineFlags["reference"] })
            }
            value={flags.reference}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="entry">Entry</SelectItem>
              <SelectItem value="liq">Liq</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  );
}
