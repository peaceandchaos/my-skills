"use client";

import { useDesk } from "@/components/desk/DeskProvider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ExecMode } from "@/lib/types";

const modes = [
  { id: "advisory", label: "Advisory" },
  { id: "paper", label: "Paper auto" },
  { id: "live", label: "Live auto" },
] as const;

export function ModeSwitch() {
  const { execMode, setExecMode } = useDesk();
  return (
    <ToggleGroup
      aria-label="Execution mode"
      onValueChange={(v) => {
        if (v) setExecMode(v as ExecMode);
      }}
      size="sm"
      spacing={0}
      type="single"
      value={execMode}
      variant="outline"
    >
      {modes.map((m) => (
        <ToggleGroupItem key={m.id} value={m.id}>
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
