"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CandlePoint, HoverPoint, LivelinePoint, OrderbookData } from "liveline";
import { fetchCandles, fetchMarkets } from "@/lib/lighter/client";
import {
  CHART_FLUSH_MS,
  CANDLE_WINDOWS,
  DEFAULT_MARKET_ID,
  DEFAULT_ORDER_USD,
  JEV_HORIZON_MS,
  JEV_INTERVAL_MS,
  LINE_CAP,
  LINE_WINDOWS,
  MAX_LEVERAGE,
} from "@/lib/lighter/config";
import { parseStats } from "@/lib/lighter/parse";
import { LighterSocket } from "@/lib/lighter/ws";
import type { JevDecision } from "@/lib/jev/mock";
import {
  applyMarks,
  equity,
  flattenMarket,
  freshAccount,
  liqPrice,
  place,
  positionFor,
  recordJev,
  unrealized,
} from "@/lib/paper/broker";
import type {
  Account,
  ChartMode,
  ExecMode,
  JevVerdict,
  LighterMarket,
  LivelineFlags,
  MarketStats,
  TicketState,
  WsStatus,
} from "@/lib/types";

const SESSION_KEY = "jev-lighter-account-v1";

const defaultFlags: LivelineFlags = {
  grid: true,
  badge: true,
  badgeTail: true,
  badgeVariant: "default",
  fill: true,
  pulse: true,
  momentum: true,
  exaggerate: true,
  showValue: false,
  valueMomentumColor: true,
  degen: false,
  degenScale: 1,
  degenDown: false,
  loading: true,
  paused: false,
  scrub: true,
  tooltipOutline: true,
  windowStyle: "text",
  lineWidth: 2,
  lerpSpeed: 0.08,
  orderbook: false,
  compareIndex: false,
  reference: "none",
};

type DeskValue = {
  markets: LighterMarket[];
  market: LighterMarket | undefined;
  marketId: number;
  setMarketId: (id: number) => void;
  stats: Record<number, MarketStats>;
  mark: number;
  wsStatus: WsStatus;
  line: LivelinePoint[];
  indexLine: LivelinePoint[];
  candles: CandlePoint[];
  liveCandle?: CandlePoint;
  candleWidth: number;
  chartMode: ChartMode;
  setChartMode: (m: ChartMode) => void;
  windowSecs: number;
  setWindowSecs: (n: number) => void;
  flags: LivelineFlags;
  setFlags: (patch: Partial<LivelineFlags>) => void;
  hover: HoverPoint | null;
  setHover: (h: HoverPoint | null) => void;
  orderbook?: OrderbookData;
  execMode: ExecMode;
  setExecMode: (m: ExecMode) => void;
  account: Account;
  ticket: TicketState;
  setTicket: (patch: Partial<TicketState>) => void;
  submitTicket: () => string | null;
  flatten: () => void;
  jev: JevVerdict | null;
  lastError: string | null;
  eq: number;
  uPnL: number;
  lastFill: Account["fills"][number] | undefined;
  currentPos: ReturnType<typeof positionFor>;
  lastLatency: number;
  lastFeeBps: number;
  lastSlipBps: number;
  reducedMotion: boolean;
};

const DeskContext = createContext<DeskValue | null>(null);

export function useDesk() {
  const v = useContext(DeskContext);
  if (!v) throw new Error("useDesk must be inside DeskProvider");
  return v;
}

function loadAccount(): Account {
  if (typeof window === "undefined") return freshAccount();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return freshAccount();
    return { ...freshAccount(), ...JSON.parse(raw) };
  } catch {
    return freshAccount();
  }
}

function bookFromLevels(
  levels: Array<{ price: string; size: string }> | undefined,
  map: Map<number, number>,
) {
  for (const row of levels ?? []) {
    const px = parseFloat(row.price);
    const sz = parseFloat(row.size);
    if (!Number.isFinite(px)) continue;
    if (!sz) map.delete(px);
    else map.set(px, sz);
  }
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<LighterMarket[]>([]);
  const [marketId, setMarketIdState] = useState(DEFAULT_MARKET_ID);
  const [stats, setStats] = useState<Record<number, MarketStats>>({});
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [line, setLine] = useState<LivelinePoint[]>([]);
  const [indexLine, setIndexLine] = useState<LivelinePoint[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [liveCandle, setLiveCandle] = useState<CandlePoint | undefined>();
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [windowSecs, setWindowSecs] = useState(300);
  const [flags, setFlagsState] = useState<LivelineFlags>(defaultFlags);
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const [orderbook, setOrderbook] = useState<OrderbookData | undefined>();
  const [execMode, setExecMode] = useState<ExecMode>("paper");
  const [account, setAccount] = useState<Account>(freshAccount);
  const [sessionRestored, setSessionRestored] = useState(false);
  if (typeof window !== "undefined" && !sessionRestored) {
    setSessionRestored(true);
    const saved = loadAccount();
    if (saved.fills.length || saved.positions.length || saved.cash !== saved.startingCash) {
      setAccount(saved);
    }
  }
  const [ticket, setTicketState] = useState<TicketState>({
    side: "buy",
    type: "market",
    quoteUsd: DEFAULT_ORDER_USD,
    leverage: 3,
    limitPrice: "",
    sl: "",
    tp: "",
    reduceOnly: false,
  });
  const [jev, setJev] = useState<JevVerdict | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const lineRef = useRef<LivelinePoint[]>([]);
  const indexRef = useRef<LivelinePoint[]>([]);
  const statsRef = useRef(stats);
  const accountRef = useRef(account);
  const marketIdRef = useRef(marketId);
  const execRef = useRef(execMode);
  const marketsRef = useRef(markets);
  const socketRef = useRef<LighterSocket | null>(null);
  const candleCh = useRef<string | null>(null);
  const bookCh = useRef<string | null>(null);
  const bidsRef = useRef(new Map<number, number>());
  const asksRef = useRef(new Map<number, number>());
  const lastSideRef = useRef<JevVerdict["side"] | null>(null);
  const liveCandleRef = useRef<CandlePoint | undefined>(undefined);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    marketIdRef.current = marketId;
  }, [marketId]);
  useEffect(() => {
    execRef.current = execMode;
  }, [execMode]);
  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  const market = useMemo(
    () => markets.find((m) => m.marketId === marketId),
    [markets, marketId],
  );
  const mark = stats[marketId]?.markPrice || market?.markPrice || 0;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    fetchMarkets()
      .then(setMarkets)
      .catch(() => setLastError("Could not load Lighter markets"));
  }, []);

  const pushTick = useCallback((t: number, markPx: number, indexPx?: number) => {
    const next = lineRef.current.concat({ time: t, value: markPx });
    if (next.length > LINE_CAP) next.splice(0, next.length - LINE_CAP);
    lineRef.current = next;
    if (indexPx && indexPx > 0) {
      const idx = indexRef.current.concat({ time: t, value: indexPx });
      if (idx.length > LINE_CAP) idx.splice(0, idx.length - LINE_CAP);
      indexRef.current = idx;
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLine(lineRef.current);
      setIndexLine(indexRef.current);
    }, CHART_FLUSH_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const sock = new LighterSocket();
    socketRef.current = sock;
    sock.subscribe("market_stats/all");
    sock.onStatus = setWsStatus;
    sock.onMessage = (msg) => {
      const type = String(msg.type ?? "");
      const channel = String(msg.channel ?? "");
      if (channel.startsWith("market_stats")) {
        const blob = (msg.market_stats ?? msg) as Record<string, unknown>;
        const entries =
          blob && typeof blob === "object" && !("mark_price" in blob)
            ? Object.entries(blob as Record<string, Record<string, unknown>>)
            : [];
        if (entries.length) {
          setStats((prev) => {
            const next = { ...prev };
            for (const [k, raw] of entries) {
              if (!raw || typeof raw !== "object") continue;
              const s = parseStats(raw, Number(k));
              next[s.marketId] = s;
              if (s.marketId === marketIdRef.current && s.markPrice) {
                pushTick(Date.now() / 1000, s.markPrice, s.indexPrice);
              }
            }
            return next;
          });
        }
      }
      if (channel.startsWith("candle:")) {
        const rows = (msg.candles as Array<Record<string, number>> | undefined) ?? [];
        const last = rows[rows.length - 1];
        if (last) {
          const c: CandlePoint = {
            time: Math.floor(last.t / 1000),
            open: last.o,
            high: last.h,
            low: last.l,
            close: last.c,
          };
          const prevLive = liveCandleRef.current;
          liveCandleRef.current = c;
          setLiveCandle(c);
          if (prevLive && prevLive.time !== c.time) {
            setCandles((cs) => cs.concat(prevLive).slice(-800));
          }
        }
      }
      if (channel.includes("order_book")) {
        const book = msg.order_book as
          | { bids?: Array<{ price: string; size: string }>; asks?: Array<{ price: string; size: string }> }
          | undefined;
        if (type.startsWith("subscribed")) {
          bidsRef.current = new Map();
          asksRef.current = new Map();
        }
        bookFromLevels(book?.bids, bidsRef.current);
        bookFromLevels(book?.asks, asksRef.current);
        const bids = [...bidsRef.current.entries()]
          .sort((a, b) => b[0] - a[0])
          .slice(0, 8)
          .map(([p, s]) => [p, s] as [number, number]);
        const asks = [...asksRef.current.entries()]
          .sort((a, b) => a[0] - b[0])
          .slice(0, 8)
          .map(([p, s]) => [p, s] as [number, number]);
        setOrderbook({ bids, asks });
      }
    };
    sock.start();
    return () => sock.stop();
  }, [pushTick]);

  const setMarketId = useCallback((id: number) => {
    setMarketIdState(id);
    setFlagsState((f) => ({ ...f, loading: true }));
    lineRef.current = [];
    indexRef.current = [];
    setLine([]);
    setIndexLine([]);
    liveCandleRef.current = undefined;
    setCandles([]);
    setLiveCandle(undefined);
    setHover(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCandles(marketId, "1m")
      .then((cs) => {
        if (cancelled) return;
        const committed = cs.slice(0, -1);
        const live = cs[cs.length - 1];
        liveCandleRef.current = live;
        setCandles(committed);
        setLiveCandle(live);
        if (cs.length) {
          const seeded = cs.map((c) => ({ time: c.time, value: c.close }));
          lineRef.current = seeded.slice(-LINE_CAP);
          indexRef.current = [];
          setLine(lineRef.current);
        }
        setFlagsState((f) => ({ ...f, loading: false }));
      })
      .catch(() => {
        if (!cancelled) setFlagsState((f) => ({ ...f, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const next = `candle/${marketId}/1m`;
    if (candleCh.current && candleCh.current !== next) sock.unsubscribe(candleCh.current);
    sock.subscribe(next);
    candleCh.current = next;
    return () => {
      if (candleCh.current) sock.unsubscribe(candleCh.current);
    };
  }, [marketId, wsStatus]);

  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const next = `order_book@tier2/${marketId}`;
    if (bookCh.current && bookCh.current !== next) sock.unsubscribe(bookCh.current);
    if (flags.orderbook) {
      sock.subscribe(next);
      bookCh.current = next;
    } else if (bookCh.current) {
      sock.unsubscribe(bookCh.current);
      bookCh.current = null;
    }
    return () => {
      if (bookCh.current) sock.unsubscribe(bookCh.current);
    };
  }, [marketId, flags.orderbook, wsStatus]);

  useEffect(() => {
    const marks: Record<number, number> = {};
    for (const [k, v] of Object.entries(statsRef.current)) {
      marks[Number(k)] = v.markPrice;
    }
    if (!Object.keys(marks).length) return;
    const id = window.setInterval(() => {
      setAccount((a) =>
        applyMarks(
          a,
          marksFrom(statsRef.current),
          (mid) => (marketsRef.current.find((m) => m.marketId === mid)?.takerFee ?? 0) * 1e4,
          (mid) => marketsRef.current.find((m) => m.marketId === mid)?.mmf ?? 600,
        ),
      );
    }, 400);
    return () => window.clearInterval(id);
  }, [mark]);

  useEffect(() => {
    const id = window.setInterval(async () => {
      const mkt = marketsRef.current.find((m) => m.marketId === marketIdRef.current);
      const s = statsRef.current[marketIdRef.current];
      if (!mkt || !s?.markPrice) return;
      const pts = lineRef.current;
      const last = pts[pts.length - 1]?.value ?? s.markPrice;
      const ago1 = pts.find((p) => p.time <= lastTime(pts) - 60);
      const ago5 = pts.find((p) => p.time <= lastTime(pts) - 300);
      const ret = (from: number | undefined) =>
        from ? ((last - from) / from) * 1e4 : 0;
      const body = {
        symbol: mkt.symbol,
        marketId: mkt.marketId,
        mark: s.markPrice,
        mid: s.midPrice || s.markPrice,
        bid: s.bestBid,
        ask: s.bestAsk,
        returnsBps1m: ret(ago1?.value),
        returnsBps5m: ret(ago5?.value),
        fundingRate: s.currentFundingRate || s.fundingRate,
        positionSign: (positionFor(accountRef.current, mkt.marketId)?.sign ?? 0) as 0 | 1 | -1,
        lastSide: lastSideRef.current,
      };
      const t0 = Date.now();
      let decision: JevDecision & { latencyMs?: number };
      try {
        const res = await fetch("/api/jev", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        decision = await res.json();
      } catch {
        return;
      }
      const latencyMs = Date.now() - t0;
      lastSideRef.current = decision.side;
      const mode = execRef.current;
      const fireSide = decision.side === "hold" ? null : decision.side;
      const shouldFire =
        !decision.skipped &&
        fireSide !== null &&
        (mode === "paper" || mode === "live");
      let next = recordJev(
        accountRef.current,
        fireSide
          ? {
              at: Date.now(),
              side: fireSide,
              mark: s.markPrice,
              marketId: mkt.marketId,
              resolveAt: Date.now() + JEV_HORIZON_MS,
            }
          : null,
      );
      let executed = false;
      if (shouldFire && fireSide) {
        const placed = place(next, {
          marketId: mkt.marketId,
          symbol: mkt.symbol,
          side: fireSide,
          type: "market",
          quoteUsd: Math.max(mkt.minQuote, DEFAULT_ORDER_USD),
          leverage: 3,
          mark: s.markPrice,
          feeBps: mkt.takerFee * 1e4,
          source: "jev",
          minQuote: mkt.minQuote,
        });
        if (placed.error) {
          setLastError(placed.error);
        } else {
          next = placed.account;
          executed = true;
        }
      }
      setAccount(next);
      setJev({
        at: Date.now(),
        marketId: mkt.marketId,
        symbol: mkt.symbol,
        gate: decision.gate,
        side: decision.side,
        pBuy: decision.pBuy,
        pSell: decision.pSell,
        pHold: decision.pHold,
        tradeNow: decision.tradeNow,
        skipped: decision.skipped,
        skipReason: decision.skipReason,
        latencyMs: decision.latencyMs ?? latencyMs,
        executed,
      });
    }, JEV_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const setFlags = useCallback((patch: Partial<LivelineFlags>) => {
    setFlagsState((f) => ({ ...f, ...patch }));
  }, []);

  const setTicket = useCallback((patch: Partial<TicketState>) => {
    setTicketState((t) => ({ ...t, ...patch }));
  }, []);

  const submitTicket = useCallback(() => {
    const mkt = marketsRef.current.find((m) => m.marketId === marketIdRef.current);
    const s = statsRef.current[marketIdRef.current];
    if (!mkt || !s?.markPrice) return "No mark yet";
    const t = ticket;
    const placed = place(accountRef.current, {
      marketId: mkt.marketId,
      symbol: mkt.symbol,
      side: t.side,
      type: t.type,
      quoteUsd: t.quoteUsd,
      leverage: t.leverage,
      mark: s.markPrice,
      feeBps: mkt.takerFee * 1e4,
      reduceOnly: t.reduceOnly,
      sl: t.sl ? Number(t.sl) : undefined,
      tp: t.tp ? Number(t.tp) : undefined,
      limitPrice: t.limitPrice ? Number(t.limitPrice) : undefined,
      source: "ticket",
      minQuote: mkt.minQuote,
    });
    if (placed.error) {
      setLastError(placed.error);
      return placed.error;
    }
    setAccount(placed.account);
    if (execMode === "live") {
      setLastError("Live signing not configured — paper fill");
    } else {
      setLastError(null);
    }
    return null;
  }, [ticket, execMode]);

  const flatten = useCallback(() => {
    const s = statsRef.current[marketIdRef.current];
    const mkt = marketsRef.current.find((m) => m.marketId === marketIdRef.current);
    if (!s?.markPrice || !mkt) return;
    setAccount((a) =>
      flattenMarket(a, marketIdRef.current, s.markPrice, mkt.takerFee * 1e4),
    );
  }, []);

  const marks = useMemo(() => {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(stats)) out[Number(k)] = v.markPrice;
    return out;
  }, [stats]);

  const eq = equity(account, marks);
  const currentPos = positionFor(account, marketId);
  const uPnL = currentPos ? unrealized(currentPos, mark || currentPos.avgEntry) : 0;
  const lastFill = account.fills[0];

  const value: DeskValue = {
    markets,
    market,
    marketId,
    setMarketId,
    stats,
    mark,
    wsStatus,
    line,
    indexLine,
    candles,
    liveCandle,
    candleWidth: 60,
    chartMode,
    setChartMode,
    windowSecs,
    setWindowSecs,
    flags,
    setFlags,
    hover,
    setHover,
    orderbook: flags.orderbook ? orderbook : undefined,
    execMode,
    setExecMode,
    account,
    ticket,
    setTicket,
    submitTicket,
    flatten,
    jev,
    lastError,
    eq,
    uPnL,
    lastFill,
    currentPos,
    lastLatency: jev?.latencyMs ?? 0,
    lastFeeBps: lastFill?.feeBps ?? (market?.takerFee ?? 0) * 1e4,
    lastSlipBps: lastFill?.slipBps ?? 0,
    reducedMotion,
  };

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

function lastTime(pts: LivelinePoint[]) {
  return pts[pts.length - 1]?.time ?? 0;
}

function marksFrom(stats: Record<number, MarketStats>) {
  const marks: Record<number, number> = {};
  for (const [k, v] of Object.entries(stats)) marks[Number(k)] = v.markPrice;
  return marks;
}

export { defaultFlags, LINE_WINDOWS, CANDLE_WINDOWS, MAX_LEVERAGE, liqPrice };
