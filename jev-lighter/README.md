# Jev · Lighter desk

Live desk: [https://jev-lighter.surge.sh](https://jev-lighter.surge.sh)

## How to run the desk

1. Install dependencies.

```bash
cd jev-lighter
npm install
```

2. Start the Next.js app.

```bash
npm run dev
```

3. Open http://localhost:3000. You should see the toolbar, a Liveline wallet chart, and a Buy or Sell ticket.

4. Wait until the toolbar says **Lighter mark**. Submit a paper buy. Flatten when you want the session flat again.

## How to publish the desk

The app is a static export. Markets, candles, and the Lighter websocket talk to Lighter from the browser. `mockDecide` runs in the tab.

```bash
cd jev-lighter
npm run deploy
```

That runs `next build` then `wrangler deploy`. The Worker name is `jev-lighter` in `wrangler.jsonc`.

`npm test` runs the paper broker, Jev mock, formatter, and window-list pins. `npx tsc --noEmit` and `npm run lint` check the app.

1. Install dependencies.

```bash
cd jev-lighter
npm install
```

2. Start the Next.js app.

```bash
npm run dev
```

3. Open http://localhost:3000. You should see the toolbar, a Liveline wallet chart, and a Buy or Sell ticket.

4. Wait until the toolbar says **Lighter mark**. Submit a paper buy. Flatten when you want the session flat again.

`npm test` runs the paper broker, Jev mock, formatter, and window-list pins. `npx tsc --noEmit` and `npm run lint` check the app.

## Desk

Standalone Next.js 16 app. Chrome is Efferd dashboard 6 plus the dashboard 5 session-vitals card. Dashboard 6 is Pro on the registry, so those blocks are ported. Do not run `shadcn add @efferd/dashboard-6` without a token.

| Slot | Component | Role |
| --- | --- | --- |
| Stats | `DashboardStats` | Win rate, session orders, AOV |
| MOR | `LiveChart` | Liveline wallet, line or candle |
| Vitals | `WebVitals` | Jev latency, fee bps, slippage |
| Orders chart | `OrderTicket` | Market or limit ticket |
| Gauge | `ProfitGauge` | Realized vs unrealized |
| Mix | `JevMix` | Buy, hold, sell stance |
| Tax card | `OpenPosition` | Current position or Flat |

Session wallet starts at `$100` (`STARTING_CASH` in `src/lib/lighter/config.ts`). Paper fills never send a Lighter transaction. Live auto still paper-fills and says so. Chart windows are one Liveline list, `DESK_WINDOWS`: 1m, 5m, 15m, 1h, and Month. Candle resolution follows the selected window.

`TYPESAFE_AI_API_KEY` is reserved for swapping `mockDecide` in `src/lib/jev/mock.ts` to TypeSafe Jev. The mock stays until that key is present.
