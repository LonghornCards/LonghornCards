// src/CombinedTrends.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import dataUrl from "./assets/Google_Trends_Data.xlsx?url";

export default function CombinedTrends() {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]); // for the charts (up to 5)

  const burntOrange = "#BF5700";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(dataUrl);
        if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        const leagues = ["NBA", "MLB", "NFL"];
        const rowMap = new Map();
        const colOrder = ["Date"];

        const addSheet = (sheetName, league) => {
          const ws = wb.Sheets[sheetName];
          if (!ws) return;
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
          if (!aoa.length) return;

          const headers = aoa[0];

          // Clean header labels: remove any parenthetical text, strip accents, append league
          const players = headers.slice(1).map((h) => {
            const cleaned = h.replace(/\s*\([^)]*\)/g, "").trim().replace(/:$/, "");
            const asciiName = toASCII(cleaned);
            return `${asciiName} (${league})`;
          });

          players.forEach((p) => {
            if (!colOrder.includes(p)) colOrder.push(p);
          });

          for (let r = 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!row || !row[0]) continue;
            const date = normalizeDate(row[0]);
            if (!date) continue;
            if (!rowMap.has(date)) rowMap.set(date, { Date: date });
            const rec = rowMap.get(date);
            players.forEach((p, i) => {
              rec[p] = row[i + 1] ?? null;
            });
          }
        };

        leagues.forEach((l) => addSheet(l, l));

        const mergedRows = [...rowMap.values()].sort((a, b) =>
          a.Date.localeCompare(b.Date)
        );

        setColumns(colOrder);
        setRows(mergedRows);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  // --- Convert "<1" → 0, parse numbers ---
  const toNum = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const t = v.trim();
      if (t.startsWith("<")) return 0;
      const n = Number(t.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  // --- Compute weekly 52w − 156w diffs for each player (week-varying) ---
  const diffRows = useMemo(() => {
    if (!rows.length || !columns.length) return [];
    return rows.map((r, rowIdx) => {
      const out = { Date: r.Date };
      for (const col of columns) {
        if (col === "Date") continue;
        const seriesUpToNow = rows.slice(0, rowIdx + 1).map((rr) => toNum(rr[col]));
        const avgLastN = (arr, n) => {
          const slice = arr.slice(-n).filter((x) => x != null);
          if (!slice.length) return 0;
          return slice.reduce((a, b) => a + b, 0) / slice.length;
        };
        const avg52 = avgLastN(seriesUpToNow, 52);
        const avg156 = avgLastN(seriesUpToNow, 156);
        out[col] = avg52 - avg156;
      }
      return out;
    });
  }, [rows, columns]);

  // --- Rank within each league per week based on diffs (scale 1–100, week-varying) ---
  const rankedRows = useMemo(() => {
    if (!diffRows.length || !columns.length) return [];
    return diffRows.map((r) => {
      const out = { Date: r.Date };
      const leagueVals = { NBA: [], MLB: [], NFL: [] };

      for (const col of columns) {
        if (col === "Date") continue;
        const m = col.match(/\((NBA|MLB|NFL)\)$/);
        if (!m) continue;
        const lg = m[1];
        const val = r[col];
        if (val != null && Number.isFinite(val)) leagueVals[lg].push(val);
      }

      const leagueStats = {};
      for (const lg of ["NBA", "MLB", "NFL"]) {
        if (leagueVals[lg].length) {
          leagueStats[lg] = {
            min: Math.min(...leagueVals[lg]),
            max: Math.max(...leagueVals[lg]),
          };
        } else {
          leagueStats[lg] = { min: 0, max: 0 };
        }
      }

      for (const col of columns) {
        if (col === "Date") continue;
        const m = col.match(/\((NBA|MLB|NFL)\)$/);
        if (!m) continue;
        const lg = m[1];
        const { min, max } = leagueStats[lg];
        const val = r[col];
        if (!Number.isFinite(val) || max === min) {
          out[col] = 50; // neutral if no spread / no data
        } else {
          out[col] = Math.round(1 + ((val - min) / (max - min)) * 99);
        }
      }

      return out;
    });
  }, [diffRows, columns]);

  if (error) {
    return (
      <div
        style={{
          color: burntOrange,
          border: `2px solid ${burntOrange}`,
          padding: 12,
          borderRadius: 8,
        }}
      >
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div
        style={{
          padding: 12,
          color: burntOrange,
          border: `2px dashed ${burntOrange}`,
          borderRadius: 8,
        }}
      >
        Loading Google Trends data…
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Top Home Button */}
      <div style={{ marginBottom: 12 }}>
        <a
          href="/"
          role="button"
          style={{
            display: "inline-block",
            textDecoration: "none",
            border: `1px solid ${burntOrange}`,
            background: "#fff",
            color: burntOrange,
            padding: "8px 14px",
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Home
        </a>
      </div>

      {/* Page Title */}
      <h1
        style={{
          margin: "0 0 12px 0",
          fontSize: 28,
          lineHeight: 1.2,
          color: burntOrange,
          fontWeight: 800,
          letterSpacing: "0.2px",
        }}
      >
        Sentiment Analysis
      </h1>

      {/* Box-Plot moved ABOVE the player list / charts */}
      <BoxPlotAllPlayers
        rankedRows={rankedRows}
        columns={columns}
        burntOrange={burntOrange}
      />

      {/* CHARTS ONLY (table removed for performance) */}
      <ChartSection
        rankedRows={rankedRows}
        columns={columns}
        selectedPlayers={selectedPlayers}
        setSelectedPlayers={setSelectedPlayers}
        burntOrange={burntOrange}
      />

      {/* Disclosure below the charts */}
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "#666",
          textAlign: "left",
          whiteSpace: "pre-wrap",
        }}
      >
        {"Source:  Underlying data sourced from Google Trends.  Calculations by Longhorn Cards convert the data to rankings based on 52- and 156-week moving averages."}
      </div>

      {/* Bottom Home Button */}
      <div style={{ marginTop: 16 }}>
        <a
          href="/"
          role="button"
          style={{
            display: "inline-block",
            textDecoration: "none",
            border: `1px solid ${burntOrange}`,
            background: "#fff",
            color: burntOrange,
            padding: "8px 14px",
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Home
        </a>
      </div>
    </div>
  );
}

/** --- Line & Bar Charts Subcomponent (pure SVG, no external deps) --- **/
function ChartSection({
  rankedRows,
  columns,
  selectedPlayers,
  setSelectedPlayers,
  burntOrange,
}) {
  const [chartLeague, setChartLeague] = useState("All"); // filter ONLY for the charts

  // Helpers to parse "Name (LEAGUE)"
  const parseCol = (c) => {
    const m = c.match(/^(.*)\s\((NBA|MLB|NFL)\)$/);
    return { name: (m?.[1] || c).trim(), league: m?.[2] || "" };
  };
  const leagueOrder = { MLB: 0, NBA: 1, NFL: 2 }; // alphabetical by sport

  // Visible & sorted player options for the chart selector
  const playerOptions = useMemo(() => {
    const all = columns.filter((c) => c !== "Date");
    const base =
      chartLeague === "All"
        ? all
        : all.filter((c) => c.endsWith(`(${chartLeague})`));

    // Sort: by sport (MLB → NBA → NFL), then by player name (ASCII already)
    const sorted = [...base].sort((a, b) => {
      const pa = parseCol(a);
      const pb = parseCol(b);
      if (chartLeague === "All") {
        const cmpL =
          (leagueOrder[pa.league] ?? 99) - (leagueOrder[pb.league] ?? 99);
        if (cmpL !== 0) return cmpL;
      }
      return pa.name.localeCompare(pb.name);
    });
    return sorted;
  }, [columns, chartLeague]);

  // Keep selections valid for current chart filter; if none remain, auto-suggest top 3 from latest week
  useEffect(() => {
    if (!rankedRows.length) return;

    setSelectedPlayers((prev) => {
      const stillValid = prev.filter((p) => playerOptions.includes(p));
      if (stillValid.length > 0) return stillValid;

      // Auto-suggest: pick top 3 by most recent row rank within current playerOptions
      const last = rankedRows[rankedRows.length - 1] || {};
      const candidates = playerOptions
        .map((c) => ({ col: c, val: last[c] }))
        .filter((e) => Number.isFinite(e.val));
      candidates.sort((a, b) => b.val - a.val);
      const suggestions = candidates.slice(0, 3).map((e) => e.col);
      return suggestions;
    });
  }, [playerOptions, rankedRows, setSelectedPlayers]);

  const togglePlayer = (p) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.length >= 5) return prev; // cap at 5
      return [...prev, p];
    });
  };

  // Chart dimensions
  const WIDTH = 900;
  const HEIGHT = 300;
  const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerW = WIDTH - MARGIN.left - MARGIN.right; // 820
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom; // 240

  // Shared helpers
  const n = rankedRows.length;
  const xLine = (i) => (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yRank = (v) => innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
  const COLORS = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];

  // Build line paths for selected players
  const linePaths = useMemo(() => {
    const makePathD = (col) => {
      let d = "";
      for (let i = 0; i < n; i++) {
        const v = rankedRows[i][col];
        if (v == null || Number.isNaN(v)) continue;
        const px = xLine(i);
        const py = yRank(v);
        d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
      }
      return d;
    };
    return selectedPlayers.map((col, idx) => ({
      col,
      d: makePathD(col),
      color: COLORS[idx % COLORS.length],
    }));
  }, [selectedPlayers, rankedRows, n]);

  // X-axis ticks (dates) for line chart
  const xTicks = useMemo(() => {
    const count = 8;
    const out = [];
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1)) * (n - 1));
      out.push({ i, date: rankedRows[i]?.Date });
    }
    return out;
  }, [rankedRows, n]);

  // Latest values for bar chart
  const latest = rankedRows[rankedRows.length - 1] || {};
  const barData = selectedPlayers.map((col, idx) => ({
    col,
    value: Number.isFinite(latest[col]) ? latest[col] : 0,
    color: COLORS[idx % COLORS.length],
  }));

  // Bar layout
  const m = Math.max(1, barData.length);
  const band = innerW / m;
  const barW = Math.max(12, band * 0.6);
  const barX = (i) => i * band + (band - barW) / 2;

  const Pill = ({ value, label }) => {
    const active = chartLeague === value;
    return (
      <button
        type="button"
        onClick={() => setChartLeague(value)}
        style={{
          border: `1px solid ${burntOrange}`,
          background: active ? burntOrange : "#fff",
          color: active ? "#fff" : burntOrange,
          padding: "6px 12px",
          borderRadius: 999,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        padding: "12px",
        borderTop: `1px solid ${burntOrange}`,
        background: "#fff",
        marginTop: 12,
      }}
    >
      {/* Chart League Filter (only affects charts) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 8,
          marginBottom: 8,
          borderBottom: "1px dashed #eee",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: burntOrange, fontWeight: 700, marginRight: 6 }}>
          Chart filter:
        </span>
        <Pill value="All" label="All" />
        <Pill value="MLB" label="MLB" />
        <Pill value="NBA" label="NBA" />
        <Pill value="NFL" label="NFL" />
      </div>

      {/* Player selector (sorted by sport, then name; show ALL names, no scrollbars) */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <span style={{ color: burntOrange, fontWeight: 700 }}>
          Compare up to 5 players:
        </span>

        {/* Grid of all player names — fully expanded, no condensing/scrollbars */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 6,
            width: "100%",
            overflow: "visible",
          }}
        >
          {playerOptions.map((p) => {
            const active = selectedPlayers.includes(p);
            const disabled = !active && selectedPlayers.length >= 5;
            return (
              <button
                key={p}
                onClick={() => togglePlayer(p)}
                disabled={disabled}
                title={disabled ? "Limit: 5 players" : ""}
                style={{
                  border: `1px solid ${burntOrange}`,
                  background: active ? burntOrange : "#fff",
                  color: active ? "#fff" : burntOrange,
                  padding: "6px 10px",
                  borderRadius: 999,
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: disabled ? 0.5 : 1,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {selectedPlayers.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            margin: "6px 0 8px 0",
          }}
        >
          {linePaths.map((p) => (
            <div key={p.col} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 4,
                  background: p.color,
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 12 }}>{p.col}</span>
            </div>
          ))}
        </div>
      )}

      {/* Charts side-by-side (line on left, bar on right) */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* Line Chart */}
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Player comparison line chart">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* y axis */}
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />
            {/* y ticks */}
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t} transform={`translate(0,${yRank(t)})`}>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">
                  {t}
                </text>
              </g>
            ))}

            {/* x axis */}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
            {xTicks.map(({ i, date }) => (
              <g key={i} transform={`translate(${xLine(i)},${innerH})`}>
                <line y1={0} y2={4} stroke="#ccc" />
                <text y={16} textAnchor="middle" fontSize="10" fill="#777">
                  {date}
                </text>
              </g>
            ))}

            {/* series paths */}
            {linePaths.map((p) => (
              <path
                key={p.col}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>

        {/* Bar Chart: most recent values for selected players */}
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Most recent weekly ranks (bar chart)">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* y axis */}
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t} transform={`translate(0,${yRank(t)})`}>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">
                  {t}
                </text>
              </g>
            ))}
            {/* x axis line */}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />

            {/* bars */}
            {barData.map((b, i) => {
              const x = barX(i);
              const y = yRank(b.value);
              const h = innerH - y;
              return (
                <g key={b.col} transform={`translate(${x},0)`}>
                  <rect x={0} y={y} width={barW} height={h} fill={b.color} />
                  {/* value label */}
                  <text
                    x={barW / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#333"
                  >
                    {Math.round(b.value)}
                  </text>
                  {/* player label */}
                  <text
                    x={barW / 2}
                    y={innerH + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#777"
                  >
                    {b.col}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** --- Box-Plot (Full Roster) — with sorting & league filters --- **/
function BoxPlotAllPlayers({ rankedRows, columns, burntOrange }) {
  const [boxLeague, setBoxLeague] = useState("All");

  // Helpers
  const parseCol = (c) => {
    const m = c.match(/^(.*)\s\((NBA|MLB|NFL)\)$/);
    return { name: (m?.[1] || c).trim(), league: m?.[2] || "" };
  };

  const allPlayerCols = useMemo(
    () => columns.filter((c) => c !== "Date"),
    [columns]
  );

  const playerCols = useMemo(() => {
    if (boxLeague === "All") return allPlayerCols;
    const suffix = `(${boxLeague})`;
    return allPlayerCols.filter((c) => c.endsWith(suffix));
  }, [allPlayerCols, boxLeague]);

  // Compute per-player stats (min, q1, median, q3, max, current), then sort by latest (descending)
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

    // Sort by latest ranking (higher first); nulls to bottom
    return unsorted.sort((a, b) => {
      const av = a.cur ?? -Infinity;
      const bv = b.cur ?? -Infinity;
      return bv - av;
    });
  }, [playerCols, rankedRows]);

  // Layout
  const LABEL_W = 240; // room for player name
  const WIDTH = 1100; // total SVG width
  const RIGHT_M = 20;
  const INNER_W = WIDTH - LABEL_W - RIGHT_M;
  const TOP_M = 58; // leave space for grid labels
  const ROW_H = 28; // per-player row height
  const H = TOP_M + statsSorted.length * ROW_H + 24; // total height

  const x = (v) => (Math.max(0, Math.min(100, v)) / 100) * INNER_W;
  const gridTicks = [0, 25, 50, 75, 100];

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
          Box Plots — Full Roster (Ranks 1–100)
        </h2>

        {/* League filters for box plots */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: burntOrange, fontWeight: 700 }}>Filter:</span>
          <Pill value="All" label="All" />
          <Pill value="MLB" label="MLB" />
          <Pill value="NBA" label="NBA" />
          <Pill value="NFL" label="NFL" />
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 10,
                background: "#f2f2f2",
                border: "1px solid #999",
              }}
            />
            <span style={{ fontSize: 12 }}>IQR (Q1–Q3)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 0,
                borderTop: "2px solid #333",
              }}
            />
            <span style={{ fontSize: 12 }}>Median</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={18} height={12}>
              <path
                d="M9 1 L16 6 L9 11 L2 6 Z"
                fill={burntOrange}
                stroke="#222"
                strokeWidth="1"
              />
            </svg>
            <span style={{ fontSize: 12 }}>Current value</span>
          </div>
        </div>
      </div>

      <svg width={WIDTH} height={H} role="img" aria-label="Box plots for all players">
        {/* Grid & x-axis labels */}
        <g transform={`translate(${LABEL_W},${TOP_M})`}>
          {gridTicks.map((t) => (
            <g key={t} transform={`translate(${x(t)},0)`}>
              <line y1={-TOP_M + 8} y2={H - TOP_M - 24} stroke="#eee" />
              <text
                x={0}
                y={H - TOP_M - 8}
                fontSize="10"
                fill="#777"
                textAnchor="middle"
              >
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
                  <text
                    x={LABEL_W - 8}
                    y={yMid + 3}
                    textAnchor="end"
                    fontSize="12"
                    fill="#999"
                  >
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

            return (
              <g key={s.col}>
                {/* Player label */}
                <text
                  x={LABEL_W - 8}
                  y={yMid + 3}
                  textAnchor="end"
                  fontSize="12"
                  fill="#333"
                >
                  {s.col}
                </text>

                {/* Whiskers & Box */}
                <g transform={`translate(${LABEL_W},0)`}>
                  <line x1={xMin} x2={xQ1} y1={yMid} y2={yMid} stroke="#aaa" />
                  <line x1={xQ3} x2={xMax} y1={yMid} y2={yMid} stroke="#aaa" />
                  <line x1={xMin} x2={xMin} y1={yMid - 5} y2={yMid + 5} stroke="#aaa" />
                  <line x1={xMax} x2={xMax} y1={yMid - 5} y2={yMid + 5} stroke="#aaa" />
                  <rect
                    x={xQ1}
                    y={yBoxTop}
                    width={Math.max(1, xQ3 - xQ1)}
                    height={yBoxH}
                    fill="#f2f2f2"
                    stroke="#999"
                  />
                  {/* Median */}
                  <line
                    x1={xMed}
                    x2={xMed}
                    y1={yBoxTop}
                    y2={yBoxTop + yBoxH}
                    stroke="#333"
                    strokeWidth={2}
                  />
                  {/* Current value marker (diamond) */}
                  {xCur != null && (
                    <path
                      d={`M ${xCur} ${yMid - 6} L ${xCur + 6} ${yMid} L ${xCur} ${yMid + 6} L ${xCur - 6} ${yMid} Z`}
                      fill={burntOrange}
                      stroke="#222"
                      strokeWidth="1"
                    />
                  )}
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/** Helpers **/
function normalizeDate(val) {
  if (typeof val === "number") {
    // Excel serial date to JS Date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = val * 24 * 60 * 60 * 1000;
    return epochToISO(new Date(epoch.getTime() + ms));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : epochToISO(d);
}
function epochToISO(dt) {
  return dt.toISOString().slice(0, 10);
}

// Remove accent marks & standardize to ASCII
function toASCII(s) {
  if (typeof s !== "string") return s;
  let out = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  // Extra mappings that normalization may not fully cover in all engines
  out = out
    .replace(/ß/g, "ss")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/Ł/g, "L")
    .replace(/ł/g, "l")
    .replace(/Ø/g, "O")
    .replace(/ø/g, "o")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe");
  return out;
}
