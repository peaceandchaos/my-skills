import type { LivelinePoint } from "liveline";

export function mergeLineHistory(
  history: LivelinePoint[],
  ticks: LivelinePoint[],
): LivelinePoint[] {
  if (!ticks.length) return history;
  const start = ticks[0].time;
  const head = history.filter((p) => p.time < start - 0.5);
  return head.length ? head.concat(ticks) : ticks;
}

export function trimTicks(
  ticks: LivelinePoint[],
  now: number,
  keepSecs: number,
  cap: number,
): LivelinePoint[] {
  const cut = now - keepSecs;
  const kept = ticks.filter((p) => p.time >= cut);
  return kept.length > cap ? kept.slice(kept.length - cap) : kept;
}

export function closesFromCandles(
  candles: Array<{ time: number; close: number }>,
): LivelinePoint[] {
  return candles.map((c) => ({ time: c.time, value: c.close }));
}
