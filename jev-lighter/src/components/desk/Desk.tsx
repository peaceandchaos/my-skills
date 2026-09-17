"use client";

import { DeskProvider } from "@/components/desk/DeskProvider";
import { HeaderBar } from "@/components/desk/HeaderBar";
import { JevStance } from "@/components/desk/JevStance";
import { KpiRow } from "@/components/desk/KpiRow";
import { LiveChart } from "@/components/desk/LiveChart";
import { OrderTicket } from "@/components/desk/OrderTicket";
import { PositionCard } from "@/components/desk/PositionCard";
import { ProfitGauge } from "@/components/desk/ProfitGauge";
import { Vitals } from "@/components/desk/Vitals";

export function Desk() {
  return (
    <DeskProvider>
      <div className="min-h-screen bg-[#0a0a0a] px-4 py-5 text-zinc-100 md:px-6">
        <div className="mx-auto max-w-[1360px]">
          <HeaderBar />
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-4">
              <KpiRow />
              <LiveChart />
              <Vitals />
            </div>
            <div className="flex flex-col gap-4">
              <ProfitGauge />
              <JevStance />
              <OrderTicket />
              <PositionCard />
            </div>
          </div>
        </div>
      </div>
    </DeskProvider>
  );
}
