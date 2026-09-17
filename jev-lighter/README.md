# Jev · Lighter desk

A testing dashboard: live **Lighter** mark data, a **Liveline** chart, and a TypeSafe-style **Jev** loop (gate + buy/sell/hold) that can paper-trade a few bucks.

This folder is a standalone Next.js app. It currently lives inside `peaceandchaos/my-skills` so Cloud Agents can ship it; extract to its own repo when you want.

## Run

```bash
cd jev-lighter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What v1 does

- All active Lighter perps, picker sorted by 24h quote volume (BTC default).
- Live mark via Lighter websocket; 1m candles via REST.
- Liveline line ↔ candle morph, TradingView-style hover card, and a **Chart** panel for every Liveline flag (degen, exaggerate, orderbook overlay, mark vs index, …).
- Session wallet starts at **$100**. Ticket: market/limit, 1–5x isolated, SL/TP, reduce-only, flatten.
- Modes: **Advisory** (Jev talks), **Paper auto** (Jev fires ~every 2s when the gate passes), **Live auto** (same fills until WASM signing is wired).
- Tiles: win rate (session round-trips + Jev 30s hit rate), all-time session orders, AOV, profit donut (realized vs unrealized), Jev stance, open position, vitals (latency / fee bps / slippage).

## Money

Paper fills never touch Lighter. Live signing is **not** enabled in this PR — turning on Live auto still paper-fills and says so. No keys required for the desk.

## Env (optional, later)

`TYPESAFE_AI_API_KEY` is reserved for swapping `/api/jev` from the mock classifier to TypeSafe Jev. The mock stays until that key is present.
