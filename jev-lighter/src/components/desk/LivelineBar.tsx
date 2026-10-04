"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { WindowStyle } from "liveline";
import type { DeskWindow } from "@/lib/lighter/config";
import type { ChartMode } from "@/lib/types";

const ACTIVE = "rgba(255,255,255,0.7)";
const INACTIVE = "rgba(255,255,255,0.25)";

export function LivelineBar({
  windows,
  windowSecs,
  onWindow,
  chartMode,
  onMode,
  windowStyle,
}: {
  windows: readonly DeskWindow[];
  windowSecs: number;
  onWindow: (secs: number) => void;
  chartMode: ChartMode;
  onMode: (mode: ChartMode) => void;
  windowStyle: WindowStyle;
}) {
  const ws = windowStyle;
  const barRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef(new Map<number, HTMLButtonElement>());
  const modeBarRef = useRef<HTMLDivElement>(null);
  const modeBtnRefs = useRef(new Map<ChartMode, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [modeIndicator, setModeIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (ws === "text") return;
    const btn = btnRefs.current.get(windowSecs);
    const bar = barRef.current;
    if (!btn || !bar) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({ left: btnRect.left - barRect.left, width: btnRect.width });
  }, [windowSecs, ws, windows]);

  useLayoutEffect(() => {
    if (ws === "text") return;
    const btn = modeBtnRefs.current.get(chartMode);
    const bar = modeBarRef.current;
    if (!btn || !bar) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setModeIndicator({ left: btnRect.left - barRect.left, width: btnRect.width });
  }, [chartMode, ws]);

  const pill = {
    position: "relative" as const,
    display: "inline-flex",
    gap: ws === "text" ? 4 : 2,
    background: ws === "text" ? "transparent" : "rgba(255,255,255,0.03)",
    borderRadius: ws === "rounded" ? 999 : 6,
    padding: ws === "text" ? 0 : ws === "rounded" ? 3 : 2,
  };
  const slide = indicator
    ? {
        position: "absolute" as const,
        top: ws === "rounded" ? 3 : 2,
        left: indicator.left,
        width: indicator.width,
        height: ws === "rounded" ? "calc(100% - 6px)" : "calc(100% - 4px)",
        background: "rgba(255,255,255,0.06)",
        borderRadius: ws === "rounded" ? 999 : 4,
        transition:
          "left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: "none" as const,
      }
    : null;
  const modeSlide =
    ws !== "text" && modeIndicator
      ? {
          position: "absolute" as const,
          top: ws === "rounded" ? 3 : 2,
          left: modeIndicator.left,
          width: modeIndicator.width,
          height: ws === "rounded" ? "calc(100% - 6px)" : "calc(100% - 4px)",
          background: "rgba(255,255,255,0.06)",
          borderRadius: ws === "rounded" ? 999 : 4,
          transition:
            "left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none" as const,
        }
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
        marginLeft: 12,
      }}
    >
      <div ref={barRef} style={pill}>
        {ws !== "text" && slide ? <div style={slide} /> : null}
        {windows.map((w) => {
          const on = w.secs === windowSecs;
          return (
            <button
              key={w.secs}
              ref={(el) => {
                if (el) btnRefs.current.set(w.secs, el);
                else btnRefs.current.delete(w.secs);
              }}
              aria-pressed={on}
              onClick={() => onWindow(w.secs)}
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 11,
                padding: ws === "text" ? "2px 6px" : "3px 10px",
                borderRadius: ws === "rounded" ? 999 : 4,
                border: "none",
                cursor: "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: on ? 600 : 400,
                background: "transparent",
                color: on ? ACTIVE : INACTIVE,
                transition: "color 0.2s, background 0.15s",
                lineHeight: "16px",
              }}
              type="button"
            >
              {w.label}
            </button>
          );
        })}
      </div>
      <div ref={modeBarRef} style={pill}>
        {ws !== "text" && modeSlide ? <div style={modeSlide} /> : null}
        <button
          ref={(el) => {
            if (el) modeBtnRefs.current.set("line", el);
            else modeBtnRefs.current.delete("line");
          }}
          aria-label="Line"
          aria-pressed={chartMode === "line"}
          onClick={() => onMode("line")}
          style={{
            position: "relative",
            zIndex: 1,
            padding: "5px 7px",
            borderRadius: ws === "rounded" ? 999 : 4,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "center",
          }}
          type="button"
        >
          <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
            <path
              d="M1 8.5C2.5 8.5 3 4 5.5 4S7.5 7 8.5 7C9.5 7 10 3.5 11 3.5"
              fill="none"
              stroke={chartMode === "line" ? ACTIVE : INACTIVE}
              strokeLinecap="round"
              strokeWidth={chartMode === "line" ? 1.5 : 1.2}
            />
          </svg>
        </button>
        <button
          ref={(el) => {
            if (el) modeBtnRefs.current.set("candle", el);
            else modeBtnRefs.current.delete("candle");
          }}
          aria-label="Candle"
          aria-pressed={chartMode === "candle"}
          onClick={() => onMode("candle")}
          style={{
            position: "relative",
            zIndex: 1,
            padding: "5px 7px",
            borderRadius: ws === "rounded" ? 999 : 4,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "center",
          }}
          type="button"
        >
          <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
            <line
              stroke={chartMode === "candle" ? ACTIVE : INACTIVE}
              strokeWidth="1"
              x1="3.5"
              x2="3.5"
              y1="1"
              y2="11"
            />
            <rect
              fill={chartMode === "candle" ? ACTIVE : INACTIVE}
              height="5"
              rx="0.5"
              width="3"
              x="2"
              y="3"
            />
            <line
              stroke={chartMode === "candle" ? ACTIVE : INACTIVE}
              strokeWidth="1"
              x1="8.5"
              x2="8.5"
              y1="2"
              y2="10"
            />
            <rect
              fill={chartMode === "candle" ? ACTIVE : INACTIVE}
              height="4"
              rx="0.5"
              width="3"
              x="7"
              y="4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
