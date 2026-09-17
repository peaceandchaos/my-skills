"use client";

import type { ReactNode } from "react";
import { ArrowRightIcon } from "lucide-react";
import { formatFullCurrency } from "@/components/formater";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, DashboardCardTitle } from "@/components/dashboard-card";
import { liqPrice, useDesk } from "@/components/desk/DeskProvider";
import { fmtPrice } from "@/lib/format";
import type { Position } from "@/lib/types";

type Detail = {
	label: string;
	value: ReactNode;
};

const FLAT_ROWS: Detail[] = [
	{ label: "Market:", value: "—" },
	{ label: "Side:", value: "—" },
	{ label: "Size:", value: "—" },
	{ label: "Entry:", value: "—" },
	{ label: "Mark:", value: "—" },
	{ label: "Liq:", value: "—" },
	{ label: "uPnL:", value: "—" },
	{
		label: "Status:",
		value: (
			<Badge className="ml-auto" variant="secondary">
				Flat
			</Badge>
		),
	},
];

function openRows(
	pos: Position,
	mark: number,
	liq: number,
	uPnL: number,
	decimals: number,
): Detail[] {
	const side = pos.sign === 1 ? "Long" : "Short";
	const notional = pos.base * (mark || pos.avgEntry);
	return [
		{ label: "Market:", value: pos.symbol },
		{ label: "Side:", value: `${side} ${pos.leverage}x isolated` },
		{
			label: "Size:",
			value: `${pos.base.toPrecision(4)} · ${formatFullCurrency(notional)}`,
		},
		{ label: "Entry:", value: fmtPrice(pos.avgEntry, decimals) },
		{ label: "Mark:", value: fmtPrice(mark || pos.avgEntry, decimals) },
		{ label: "Liq:", value: fmtPrice(liq, decimals) },
		{ label: "uPnL:", value: formatFullCurrency(uPnL) },
		{
			label: "Status:",
			value: (
				<Badge className="ml-auto" variant="secondary">
					Open
				</Badge>
			),
		},
	];
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<div className="min-w-0 text-right tabular-nums text-foreground">
				{children}
			</div>
		</div>
	);
}

export function FedIncomeTax() {
	const { currentPos, market, mark, uPnL } = useDesk();
	const decimals = market?.priceDecimals ?? 2;
	const liq = currentPos && market ? liqPrice(currentPos, market.mmf) : 0;
	const rows = currentPos
		? openRows(currentPos, mark, liq, uPnL, decimals)
		: FLAT_ROWS;

	return (
		<DashboardCard className="flex-1 gap-5">
			<DashboardCardTitle>Open position</DashboardCardTitle>

			<div className="flex flex-col gap-3">
				{rows.map((row) => (
					<DetailRow key={row.label} label={row.label}>
						{row.value}
					</DetailRow>
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
				View Details
				<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
			</Button>
		</DashboardCard>
	);
}
