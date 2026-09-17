"use client";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { useDesk } from "@/components/desk/DeskProvider";

const LINE_COUNT = 64;

type StanceVariant = "buy" | "hold" | "sell";

const STANCE_VARIANTS: Record<
	StanceVariant,
	{ label: string; color: string }
> = {
	buy: {
		label: "Buy",
		color: "bg-chart-2",
	},
	hold: {
		label: "Hold",
		color: "bg-chart-2/35",
	},
	sell: {
		label: "Sell",
		color: "bg-chart-2/20",
	},
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function StanceMixTick({
	variant,
	isLead,
}: {
	variant: StanceVariant;
	isLead?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex h-full min-w-0 flex-1 items-end justify-center",
				isLead && "h-[250%]"
			)}
		>
			<div
				className={cn(
					"h-full w-0.5 shrink-0 rounded-full",
					STANCE_VARIANTS[variant].color
				)}
			/>
		</div>
	);
}

export function JevMix() {
	const { jev } = useDesk();
	const pBuy = jev?.pBuy ?? 0;
	const pHold = jev?.pHold ?? 1;
	const pSell = jev?.pSell ?? 0;
	const side = (jev?.side ?? "hold").toUpperCase();

	const buyLines = clamp(Math.round(LINE_COUNT * pBuy), 0, LINE_COUNT);
	const sellLines = clamp(Math.round(LINE_COUNT * pSell), 0, LINE_COUNT - buyLines);
	const holdLines = Math.max(0, LINE_COUNT - buyLines - sellLines);
	const buyPercent = pBuy * 100;
	const holdPercent = pHold * 100;
	const sellPercent = pSell * 100;

	const mixTicks = [
		...Array.from({ length: buyLines }, (_, index) => ({
			id: `buy-${index}`,
			variant: "buy" as const,
			isLead: index === 0,
		})),
		...Array.from({ length: holdLines }, (_, index) => ({
			id: `hold-${index}`,
			variant: "hold" as const,
			isLead: buyLines === 0 && index === 0,
		})),
		...Array.from({ length: sellLines }, (_, index) => ({
			id: `sell-${index}`,
			variant: "sell" as const,
			isLead: buyLines === 0 && holdLines === 0 && index === 0,
		})),
	];

	const dominant =
		buyPercent >= holdPercent && buyPercent >= sellPercent
			? { percent: buyPercent, at: (buyLines / LINE_COUNT) * 100 }
			: sellPercent >= holdPercent
				? { percent: sellPercent, at: ((buyLines + holdLines) / LINE_COUNT) * 100 }
				: { percent: holdPercent, at: ((buyLines + holdLines) / LINE_COUNT) * 100 };
	const labelLeft =
		dominant.percent >= 99 ? 50 : Math.min(Math.max(dominant.at, 8), 92);

	const summary = `Buy ${fmtPct(pBuy, 1)}, hold ${fmtPct(pHold, 1)}, sell ${fmtPct(pSell, 1)}`;

	return (
		<DashboardCard className="gap-0">
			<div className="-mb-2 flex flex-col gap-0.5 ps-3">
				<DashboardCardTitle>Jev stance</DashboardCardTitle>
				<p className="text-balance font-semibold text-2xl text-foreground tabular-nums tracking-tight">
					{side}
				</p>
			</div>

			<p className="sr-only">
				Jev stance {side}. {summary}
			</p>

			<div className="relative pt-5">
				{dominant.percent > 40 ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
						style={{ left: `${labelLeft}%` }}
					>
						<div className="flex flex-col items-center">
							<span className="font-medium text-foreground text-xs tabular-nums">
								{fmtPct(dominant.percent / 100, 0)}
							</span>
							<div className="h-1 w-px shrink-0 bg-muted-foreground/35" />
						</div>
					</div>
				) : null}
				<div
					aria-hidden="true"
					className="flex h-7 w-full min-w-0 items-end gap-px"
				>
					{mixTicks.map((tick) => (
						<StanceMixTick
							isLead={tick.isLead}
							key={tick.id}
							variant={tick.variant}
						/>
					))}
				</div>
			</div>

			<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
				{(Object.keys(STANCE_VARIANTS) as StanceVariant[]).map((variant) => (
					<span
						className="flex cursor-default items-center gap-2 text-muted-foreground underline decoration-muted-foreground/70 decoration-dotted underline-offset-4"
						key={variant}
					>
						<span
							aria-hidden="true"
							className={cn(
								"size-2 shrink-0 rounded-full",
								STANCE_VARIANTS[variant].color
							)}
						/>
						{STANCE_VARIANTS[variant].label}
					</span>
				))}
			</div>
		</DashboardCard>
	);
}
