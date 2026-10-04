"use client";

import { MarketPicker } from "@/components/desk/MarketPicker";
import { ModeSwitch } from "@/components/desk/ModeSwitch";
import { useDesk } from "@/components/desk/DeskProvider";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DESK_WINDOWS } from "@/lib/lighter/config";
import { cn } from "@/lib/utils";

export function TopToolbar() {
	const { wsStatus, flatten, currentPos, windowSecs, setWindowSecs } = useDesk();
	const periodValue = DESK_WINDOWS.some((o) => o.secs === windowSecs)
		? String(windowSecs)
		: "300";
	const periodLabel = `Last ${
		DESK_WINDOWS.find((o) => String(o.secs) === periodValue)?.label ?? "5m"
	}`;

	return (
		<div className="flex w-full flex-col items-start justify-between gap-4 lg:flex-row">
			<h2 className="text-balance font-semibold text-xl">Jev · Lighter</h2>
			<div className="flex w-full flex-wrap-reverse items-center justify-end gap-2 sm:flex-nowrap lg:w-max">
				<MarketPicker />
				<span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
					<span
						className={cn(
							"size-1.5 rounded-full",
							wsStatus === "live" && "bg-emerald-400",
							wsStatus === "connecting" && "bg-amber-400",
							wsStatus === "down" && "bg-destructive"
						)}
					/>
					{wsStatus === "live" ? "Lighter mark" : wsStatus}
				</span>
				<Select
					onValueChange={(v) => setWindowSecs(Number(v))}
					value={periodValue}
				>
					<SelectTrigger aria-label="Liveline window">
						<span className="min-w-0 truncate">{periodLabel}</span>
					</SelectTrigger>
					<SelectContent align="start">
						{DESK_WINDOWS.map((o) => (
							<SelectItem key={o.secs} value={String(o.secs)}>
								Last {o.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Separator className="hidden sm:block" orientation="vertical" />

				<div className="flex w-full items-center justify-end gap-2 sm:w-auto">
					<ModeSwitch />
					<Button
						disabled={!currentPos}
						onClick={flatten}
						variant="outline"
					>
						Flatten
					</Button>
				</div>
			</div>
		</div>
	);
}
