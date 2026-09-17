"use client";

import { cn } from "@/lib/cn";
import { useDesk } from "@/components/desk/DeskProvider";

const modes = [
  { id: "advisory", label: "Advisory" },
  { id: "paper", label: "Paper auto" },
  { id: "live", label: "Live auto" },
] as const;

export function ModeSwitch() {
  const { execMode, setExecMode } = useDesk();
  return (
    <div
      className="flex rounded-full bg-white/5 p-1 text-[13px]"
      role="tablist"
      aria-label="Execution mode"
    >
      {modes.map((m) => {
        const on = execMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setExecMode(m.id)}
            className={cn(
              "rounded-full px-3 py-1.5 motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97]",
              on ? "bg-white/12 text-white" : "text-white/50 hover:text-white/80",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
