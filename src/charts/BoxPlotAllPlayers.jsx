// src/charts/BoxPlotAllPlayers.jsx
import React, { useMemo, useRef, useState } from "react";
import { useContainerWidth } from "../utils/chartUtils";

export default function BoxPlotAllPlayers({ rankedRows, columns, burntOrange }) {
  const [boxLeague, setBoxLeague] = useState("All");
  const [wrapRef, widthPx] = useContainerWidth(680);
  const scrollRef = useRef(null); // scrolling container (for tooltip positioning)

  // Tooltip state
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    html: "",
  });

  const LABEL_W = Math.min(300, Math.max(180, Math.round(widthPx * 0.22)));
  const WIDTH = widthPx;
  const RIGHT_M = 16;
  const INNER_W = WIDTH - LABEL_W - RIGHT_M;
  const TOP_M = 52;
  const ROW_H = 22;

  const allPlayerCols = useMemo(() => columns.filter((c) => c !== "Date"), [columns]);

  const playerCols = useMemo(() => {
    if (boxLeague === "All") return allPlayerCols;
    const suffix = `(${boxLeague})`;
    return allPlayerCols.filter((c) => c.endsWith(suffix));
  }, [allPlayerCols, boxLeague]);

  const statsSorted = useMemo(() => {
    const q = (sorted, t) => {
      if (!sorted.length) return null;
      const pos = (sorted.length - 1) * t;
      const base = Math.floor(pos);
      const rest = pos - base;
      const next = sorted[base + 1];
      return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
    };

    const latestFinite = (col) => {
      for (let i = rankedRows.length - 1; i >= 0; i--) {
        const v = rankedRows[i][col];
        if (Number.isFinite(v)) return v;
      }
      return null;
    };

    const unsorted = playerCols.map((col) => {
      const values = rankedRows.map((r) => r[col]).filter((v) => Number.isFinite(v));
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted.length ? sorted[0] : null;
      const max = sorted.length ? sorted[sorted.length - 1] : null;
      const q1 = q(sorted, 0.25);
      const med = q(sorted, 0.5);
      const q3 = q(sorted, 0.75);
      const cur = latestFinite(col);
      return { col, min, q1, med, q3, max, cur, hasData: sorted.length > 0 };
    });

    // Sort by current (descending)
    return unsorted.sort((a, b) => (b.cur ?? -Infinity) - (a.cur ?? -Infinity));
  }, [playerCols, rankedRows]);

  const H = TOP_M + statsSorted.length * ROW_H + 28;
  const x = (v) => (Math.max(0, Math.min(100, v)) / 100) * INNER_W;
  const gridTicks = [0, 25, 50, 75, 100];

  const fmt = (v) => {
    if (v == null || !Number.isFinite(v)) return "—";
    // Show whole number if it's effectively an integer; otherwise 1 decimal
    return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1);
  };

  const Pill = ({ value, label }) => {
    const active = boxLeague === value;
    return (
      <button
        type="button"
        onClick={() => setBoxLeague(value)}
        style={{
          border: `1px solid ${burntOrange}`,
          background: active ? burntOrange : "#fff",
          color: active ? "#fff" : burntOrange,
          padding: "6px 12px",
          borderRadius: 999,
          cursor: "pointer",
          fontWeight: 600,
          marginLeft: 6,
        }}
      >
        {label}
      </button>
    );
  };

  // Build tooltip HTML for a row's stats
  const buildTooltipHTML = (label, s) => {
    return `
      <div style="font-weight:700;margin-bottom:4px;">${label}</div>
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:12px;line-height:1.25;">
        <span>Min:</span><span>${fmt(s.min)}</span>
        <span>Q1:</span><span>${fmt(s.q1)}</span>
        <span>Median:</span><span>${fmt(s.med)}</span>
        <span>Q3:</span><span>${fmt(s.q3)}</span>
        <span>Max:</span><span>${fmt(s.max)}</span>
        <span>Current:</span><span>${fmt(s.cur)}</span>
      </div>
    `;
  };

  const positionTooltip = (evt, html) => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const rect = scrollEl.getBoundingClientRect();
    // Mouse pos relative to scroll container (which is positioned relative)
    const relX = evt.clientX - rect.left + scrollEl.scrollLeft;
    const relY = evt.clientY - rect.top + scrollEl.scrollTop;

    // Slight offset so the tooltip doesn't sit under the cursor
    const x = relX + 12;
    const y = relY + 12;

    setTooltip({ show: true, x, y, html });
  };

  const hideTooltip = () => setTooltip((t) => ({ ...t, show: false }));

  return (
    <div
      style={{
        marginTop: 18,
        padding: 12,
        borderTop: `1px solid ${burntOrange}`,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h2 style={{ color: burntOrange, margin: 0, fontSize: 20, fontWeight: 800 }}>
          Box Plots for Sentiment Rankings Based on Google Trends (Ranks 1–100)
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: burntOrange, fontWeight: 700 }}>Filter:</span>
          <Pill value="All" label="All" />
          <Pill value="MLB" label="MLB" />
          <Pill value="NBA" label="NBA" />
          <Pill value="NFL" label="NFL" />
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              title="Interquartile Range (Q1–Q3)"
              style={{ display: "inline-block", width: 18, height: 10, background: "#f2f2f2", border: "1px solid #999" }}
            />
            <span style={{ fontSize: 12 }}>IQR (Q1–Q3)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              title="Median"
              style={{ display: "inline-block", width: 18, height: 0, borderTop: "2px solid #333" }}
            />
            <span style={{ fontSize: 12 }}>Median</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={18} height={12} aria-hidden>
              <path d="M9 1 L16 6 L9 11 L2 6 Z" fill={burntOrange} stroke="#222" strokeWidth="1" />
            </svg>
            <span style={{ fontSize: 12 }}>Current value</span>
          </div>
        </div>
      </div>

      <div ref={wrapRef} style={{ width: "100%" }}>
        {/* Scrolling region must be the positioning context for the tooltip */}
        <div
          ref={scrollRef}
          style={{
            maxHeight: 560,
            overflowY: "auto",
            border: "1px solid #eee",
            borderRadius: 8,
            position: "relative",
          }}
        >
          <svg width={WIDTH} height={H} role="img" aria-label="Box plots for all players">
            {/* Grid */}
            <g transform={`translate(${LABEL_W},${TOP_M})`}>
              {gridTicks.map((t) => (
                <g key={t} transform={`translate(${x(t)},0)`}>
                  <line y1={-TOP_M + 8} y2={H - TOP_M - 24} stroke="#eee" />
                  <text x={0} y={H - TOP_M - 8} fontSize="10" fill="#777" textAnchor="middle">
                    {t}
                  </text>
                </g>
              ))}
            </g>

            {/* Rows */}
            <g transform={`translate(0,${TOP_M})`}>
              {statsSorted.map((s, idx) => {
                const yMid = idx * ROW_H + ROW_H / 2;
                const yBoxTop = yMid - 6;
                const yBoxH = 12;

                if (!s.hasData) {
                  return (
                    <g key={s.col}>
                      <text x={LABEL_W - 8} y={yMid + 3} textAnchor="end" fontSize="12" fill="#999">
                        {s.col}
                      </text>
                      <text x={LABEL_W + 8} y={yMid + 3} fontSize="11" fill="#bbb">
                        No data
                      </text>
                    </g>
                  );
                }

                const xMin = x(s.min);
                const xQ1 = x(s.q1);
                const xMed = x(s.med);
                const xQ3 = x(s.q3);
                const xMax = x(s.max);
                const xCur = s.cur == null ? null : x(s.cur);

                // Simple title strings as a fallback (native SVG tooltip)
                const titleText = `${s.col}
Min: ${fmt(s.min)}  Q1: ${fmt(s.q1)}
Median: ${fmt(s.med)}  Q3: ${fmt(s.q3)}
Max: ${fmt(s.max)}  Current: ${fmt(s.cur)}`;

                // Hover handlers for tooltip
                const onMove = (evt) => positionTooltip(evt, buildTooltipHTML(s.col, s));
                const onEnter = (evt) => positionTooltip(evt, buildTooltipHTML(s.col, s));
                const onLeave = () => hideTooltip();

                return (
                  <g key={s.col}>
                    <text x={LABEL_W - 8} y={yMid + 3} textAnchor="end" fontSize="12" fill="#333">
                      {s.col}
                    </text>

                    <g transform={`translate(${LABEL_W},0)`}>
                      {/* Whiskers */}
                      <line x1={xMin} x2={xQ1} y1={yMid} y2={yMid} stroke="#aaa">
                        <title>{titleText}</title>
                      </line>
                      <line x1={xQ3} x2={xMax} y1={yMid} y2={yMid} stroke="#aaa">
                        <title>{titleText}</title>
                      </line>
                      <line x1={xMin} x2={xMin} y1={yMid - 4} y2={yMid + 4} stroke="#aaa">
                        <title>{titleText}</title>
                      </line>
                      <line x1={xMax} x2={xMax} y1={yMid - 4} y2={yMid + 4} stroke="#aaa">
                        <title>{titleText}</title>
                      </line>

                      {/* IQR box */}
                      <rect
                        x={xQ1}
                        y={yBoxTop}
                        width={Math.max(1, xQ3 - xQ1)}
                        height={yBoxH}
                        fill="#f2f2f2"
                        stroke="#999"
                      >
                        <title>{titleText}</title>
                      </rect>

                      {/* Median */}
                      <line x1={xMed} x2={xMed} y1={yBoxTop} y2={yBoxTop + yBoxH} stroke="#333" strokeWidth={2}>
                        <title>{titleText}</title>
                      </line>

                      {/* Current marker */}
                      {xCur != null && (
                        <path
                          d={`M ${xCur} ${yMid - 6} L ${xCur + 6} ${yMid} L ${xCur} ${yMid + 6} L ${xCur - 6} ${yMid} Z`}
                          fill={burntOrange}
                          stroke="#222"
                          strokeWidth="1"
                        >
                          <title>{`${s.col} — Current: ${fmt(s.cur)}`}</title>
                        </path>
                      )}

                      {/* Transparent hover target spanning the row to trigger HTML tooltip */}
                      <rect
                        x={0}
                        y={yMid - Math.max(12, yBoxH)}
                        width={INNER_W}
                        height={Math.max(24, yBoxH * 2)}
                        fill="transparent"
                        onMouseEnter={onEnter}
                        onMouseMove={onMove}
                        onMouseLeave={onLeave}
                        aria-label={`${s.col} stats hover target`}
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating HTML tooltip */}
          {tooltip.show && (
            <div
              // Positioned relative to the scrolling container
              style={{
                position: "absolute",
                left: tooltip.x,
                top: tooltip.y,
                maxWidth: 260,
                background: "rgba(0,0,0,0.85)",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                pointerEvents: "none",
                zIndex: 2,
                transform: "translate(0, -4px)",
                whiteSpace: "normal",
              }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: tooltip.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
