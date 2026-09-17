export function usd(n: number, digits = 2) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${n < 0 ? "-" : ""}$${formatted}`;
}

export function compactUsd(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return usd(n);
}

export function fmtPrice(n: number, decimals: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  });
}

export function fmtBps(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(1)} bps`;
}

export function fmtMs(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}

export function fmtPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "" : "−"}${Math.abs(n * 100).toFixed(digits)}%`;
}

export function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function fmtTime(tsSec: number) {
  const d = new Date(tsSec * 1000);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtChartTime(tsSec: number, windowSecs: number) {
  const d = new Date(tsSec * 1000);
  if (windowSecs >= 86_400) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (windowSecs >= 3600) {
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return fmtTime(tsSec);
}

export function fmtDate(tsMs: number) {
  return new Date(tsMs).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
