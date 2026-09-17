"use client";

import type { ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";
import { formatFullCurrency } from "@/components/formater";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { liqPrice, useDesk } from "@/components/desk/DeskProvider";
import { fmtPrice } from "@/lib/format";

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<div className="min-w-0 text-right text-foreground">{children}</div>
		</div>
	);
}

export function FedIncomeTax() {
	const { currentPos, market, mark, uPnL } = useDesk();
	const pos = currentPos;
	const decimals = market?.priceDecimals ?? 2;
	const liq = pos && market ? liqPrice(pos, market.mmf) : 0;
	const side = pos ? (pos.sign === 1 ? "Long" : "Short") : null;
	const notional = pos ? pos.base * (mark || pos.avgEntry) : 0;

	return (
		<DashboardCard className="flex-1 gap-5">
			<DashboardCardTitle>Open position</DashboardCardTitle>

			<div className="flex flex-col gap-3">
				<DetailRow label="Market:">
					<span className="tabular-nums">{pos?.symbol ?? "—"}</span>
				</DetailRow>
				<DetailRow label="Side:">
					<span className="tabular-nums">
						{side ? `${side} ${pos?.leverage}x isolated` : "—"}
					</span>
				</DetailRow>
				<DetailRow label="Size:">
					<span className="tabular-nums">
						{pos
							? `${pos.base.toPrecision(4)} · ${formatFullCurrency(notional)}`
							: "—"}
					</span>
				</DetailRow>
				<DetailRow label="Entry:">
					<span className="tabular-nums">
						{pos ? fmtPrice(pos.avgEntry, decimals) : "—"}
					</span>
				</DetailRow>
				<DetailRow label="Mark:">
					<span className="tabular-nums">
						{pos ? fmtPrice(mark || pos.avgEntry, decimals) : "—"}
					</span>
				</DetailRow>
				<DetailRow label="Liq:">
					<span className="tabular-nums">
						{pos ? fmtPrice(liq, decimals) : "—"}
					</span>
				</DetailRow>
				<DetailRow label="uPnL:">
					<span className="tabular-nums">
						{pos ? formatFullCurrency(uPnL) : "—"}
					</span>
				</DetailRow>
				<DetailRow label="Status:">
					<Badge className="ml-auto" variant="secondary">
						{pos ? "Open" : "Flat"}
					</Badge>
				</DetailRow>
			</div>

			<Button
				className="w-full"
				onClick={() =>
					document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth" })
				}
				size="sm"
				variant="secondary"
			>
				View Details
				<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
			</Button>
		</DashboardCard>
	);
}
