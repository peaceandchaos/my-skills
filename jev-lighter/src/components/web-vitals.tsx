"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { useDesk } from "@/components/desk/DeskProvider";
import { fmtBps, fmtMs } from "@/lib/format";

export function WebVitals() {
	const { lastLatency, lastFeeBps, lastSlipBps, account } = useDesk();
	const jevHit = account.jevResolved ? account.jevHits / account.jevResolved : 0;
	const vitals = [
		{
			label: "Jev",
			name: "Decision latency",
			value: lastLatency ? fmtMs(lastLatency) : "—",
			delta: lastLatency ? 250 - lastLatency : 0,
			deltaLabel: account.jevResolved
				? `${Math.round(jevHit * 100)}% hit at 30s horizon`
				: "mockDecide in this tab",
			suffix: "ms",
		},
		{
			label: "Fee",
			name: "Last fill · Lighter taker",
			value: fmtBps(lastFeeBps),
			delta: 0,
			deltaLabel: "this origin / last fill",
			suffix: "",
		},
		{
			label: "Slip",
			name: "Slippage vs mark",
			value: fmtBps(lastSlipBps),
			delta: account.fills.length ? 2 - lastSlipBps : 0,
			deltaLabel: "last fill vs mark",
			suffix: " bps",
		},
	] as const;

	return (
		<Card className="dark:bg-transparent">
			<CardHeader className="border-b">
				<CardTitle className="text-balance">Session vitals</CardTitle>
				<CardDescription className="text-pretty">
					Field experience on this origin, measured from Jev calls and fills.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-6 sm:grid-cols-3">
					{vitals.map((v) => (
						<li className="flex flex-col gap-1" key={v.label}>
							<p className="text-pretty font-medium text-sm">{v.label}</p>
							<p className="text-pretty text-muted-foreground text-xs">
								{v.name}
							</p>
							<p className="text-balance font-semibold text-2xl tabular-nums">
								{v.value}
							</p>
							<div className="flex items-center gap-1.5 text-pretty text-muted-foreground text-xs">
								<Delta value={v.delta} variant="default">
									<DeltaIcon />
									<DeltaValue suffix={v.suffix} />
								</Delta>
								<span>{v.deltaLabel}</span>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
