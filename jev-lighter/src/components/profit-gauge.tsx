"use client";

import type { ComponentProps } from "react";
import { ArrowRightIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, usd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { useDesk } from "@/components/desk/DeskProvider";

const GAUGE_SEGMENTS = 52;
const VB = { w: 240, h: 200 };
const CX = 120;
const CY = 118;
const R_MID = 92;
const TICK_HALF = 10;
const STROKE = 4.5;

type ProfitSplitVariant = "realized" | "unrealized";

const PROFIT_SPLIT: Record<
	ProfitSplitVariant,
	{ label: string; color: string; opacity?: number }
> = {
	realized: {
		label: "Realized",
		color: "var(--chart-2)",
	},
	unrealized: {
		label: "Unrealized",
		color: "var(--chart-2)",
		opacity: 0.35,
	},
};

function round2(n: number) {
	return Math.round(n * 100) / 100;
}

const GAUGE_TICKS = Array.from({ length: GAUGE_SEGMENTS }, (_, index) => {
	const denom = Math.max(1, GAUGE_SEGMENTS - 1);
	const rad = ((-135 + (index / denom) * 270) * Math.PI) / 180;
	const sin = Math.sin(rad);
	const cos = Math.cos(rad);
	const r1 = R_MID - TICK_HALF;
	const r2 = R_MID + TICK_HALF;
	return {
		x1: round2(CX + r1 * sin),
		y1: round2(CY - r1 * cos),
		x2: round2(CX + r2 * sin),
		y2: round2(CY - r2 * cos),
	};
});

function ProfitRadialGauge({
	progress,
	className,
	children,
	...props
}: ComponentProps<"div"> & { progress: number }) {
	const clamped = Math.min(1, Math.max(0, progress));
	const filledCount = Math.round(clamped * GAUGE_SEGMENTS);

	return (
		<div
			aria-hidden
			className={cn("relative isolate mx-auto size-full max-w-80", className)}
			style={{ aspectRatio: `${VB.w} / ${VB.h}` }}
			{...props}
		>
			<svg
				className="inset-0 size-full overflow-visible"
				viewBox={`0 0 ${VB.w} ${VB.h}`}
			>
				{GAUGE_TICKS.map((tick, index) => {
					const active = index < filledCount;
					const split = active
						? PROFIT_SPLIT.realized
						: PROFIT_SPLIT.unrealized;

					return (
						<line
							key={`gauge-${index}`}
							stroke={split.color}
							strokeLinecap="round"
							strokeOpacity={split.opacity ?? 1}
							strokeWidth={STROKE}
							x1={tick.x1}
							x2={tick.x2}
							y1={tick.y1}
							y2={tick.y2}
						/>
					);
				})}
			</svg>

			<div className="absolute inset-0 top-1/6 flex flex-col items-center justify-center">
				{children}
			</div>
		</div>
	);
}

export function ProfitGauge() {
	const { account, uPnL } = useDesk();
	const realized = account.realizedPnl;
	const unreal = uPnL;
	const total = realized + unreal;
	const mag = Math.abs(realized) + Math.abs(unreal);
	const progress = mag > 0 ? Math.abs(realized) / mag : 0;
	const gaugeLabel = `Realized profit share ${fmtPct(progress, 1)}`;

	return (
		<DashboardCard className="gap-4">
			<div className="sr-only">{gaugeLabel}</div>

			<ProfitRadialGauge progress={progress}>
				<div
					className={cn(
						"flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-4"
					)}
				>
					<WalletIcon aria-hidden="true" />
				</div>
				<div className="relative z-10 mt-2 flex w-full flex-col items-center">
					<DashboardCardTitle>Profit</DashboardCardTitle>
					<span className="text-balance text-center font-medium text-foreground text-sm tabular-nums tracking-tight">
						{usd(total)}
					</span>
				</div>
			</ProfitRadialGauge>

			<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
				{(Object.keys(PROFIT_SPLIT) as ProfitSplitVariant[]).map((variant) => (
					<span
						className="flex cursor-default items-center gap-2 text-muted-foreground underline decoration-muted-foreground/70 decoration-dotted underline-offset-4"
						key={variant}
					>
						<span
							aria-hidden="true"
							className="size-2 shrink-0 rounded-full"
							style={{
								backgroundColor: PROFIT_SPLIT[variant].color,
								opacity: PROFIT_SPLIT[variant].opacity ?? 1,
							}}
						/>
						{PROFIT_SPLIT[variant].label}
					</span>
				))}
			</div>

			<Button
				className="w-full"
				onClick={() =>
					document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth" })
				}
				size="sm"
				variant="secondary"
			>
				View Detail
				<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
			</Button>
		</DashboardCard>
	);
}
