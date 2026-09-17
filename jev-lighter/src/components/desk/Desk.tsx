"use client";

import { DeskProvider } from "@/components/desk/DeskProvider";
import { LiveChart } from "@/components/desk/LiveChart";
import { OrderTicket } from "@/components/desk/OrderTicket";
import { DashboardCardSeparator } from "@/components/dashboard-card";
import { JevMix } from "@/components/jev-mix";
import { OpenPosition } from "@/components/open-position";
import { ProfitGauge } from "@/components/profit-gauge";
import { DashboardStats } from "@/components/stats";
import { TopToolbar } from "@/components/top-toolbar";
import { WebVitals } from "@/components/web-vitals";
import { cn } from "@/lib/utils";

export function Desk() {
  return (
    <DeskProvider>
      <div className="min-h-screen bg-background px-4 py-6 text-foreground md:px-6">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-6">
          <TopToolbar />
          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              "lg:grid-cols-[.68fr_.32fr] xl:grid-cols-[.70fr_.30fr]",
              "*:grid *:h-max *:gap-2",
            )}
          >
            <div>
              <DashboardStats />
              <DashboardCardSeparator />
              <LiveChart />
              <DashboardCardSeparator />
              <WebVitals />
              <DashboardCardSeparator />
              <OrderTicket />
            </div>
            <div className="relative">
              <DashboardCardSeparator
                className="absolute inset-y-0 -left-2 hidden h-full w-px lg:block"
                orientation="vertical"
              />
              <DashboardCardSeparator
                className="block lg:hidden"
                orientation="horizontal"
              />
              <ProfitGauge />
              <DashboardCardSeparator />
              <JevMix />
              <DashboardCardSeparator />
              <OpenPosition />
            </div>
          </div>
        </div>
      </div>
    </DeskProvider>
  );
}
