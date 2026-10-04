"use client";

import { cn } from "@/lib/utils";
import { fmtInt, fmtPct, usd } from "@/lib/format";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import {
	DashboardCard,
	DashboardCardSeparator,
	DashboardCardTitle,
} from "@/components/dashboard-card";
import { useDesk } from "@/components/desk/DeskProvider";

type Stat = {
	label: string;
	value: string;
	delta: number;
	hint: string;
};

export function DashboardStats() {
	const { account } = useDesk();
	const closed = account.closed.length;
	const wins = account.closed.filter((t) => t.win).length;
	const winRate = closed ? wins / closed : 0;
	const notional = account.fills.reduce((s, f) => s + f.notional, 0);
	const orders = account.fills.length;
	const aov = orders ? notional / orders : 0;

	const stats: readonly Stat[] = [
		{
			label: "Win rate",
			value: closed ? fmtPct(winRate, 1) : "—",
			delta: closed ? (winRate - 0.5) * 100 : 0,
			hint: "session round-trips",
		},
		{
			label: "Orders",
			value: fmtInt(orders),
			delta: 0,
			hint: "all-time this session",
		},
		{
			label: "Average order value",
			value: orders ? usd(aov) : "—",
			delta: 0,
			hint: "all-time this session",
		},
	];

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3">
			{stats.map((s) => (
				<StatCard key={s.label} stat={s} />
			))}
		</div>
	);
}

function StatCard({ stat }: { stat: Stat }) {
	const { label, value, delta, hint } = stat;
	return (
		<DashboardCard className="group">
			<DashboardCardSeparator
				className={cn("absolute bottom-0 group-last:hidden lg:hidden")}
				orientation="horizontal"
			/>
			<DashboardCardSeparator
				className={cn(
					"absolute right-0 hidden h-full group-last:hidden lg:block"
				)}
				orientation="vertical"
			/>

			<div className="flex min-w-0 flex-col justify-center gap-2">
				<DashboardCardTitle>{label}</DashboardCardTitle>
				<span className="text-balance font-medium text-2xl tabular-nums tracking-tight">
					{value}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-1 text-xs">
				<Delta value={delta}>
					<DeltaIcon filled variant="arrow" />
					<DeltaValue />
				</Delta>
				<span className="text-pretty text-muted-foreground">{hint}</span>
			</div>
		</DashboardCard>
	);
}
