// src/Research.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import dataUrl from "./assets/Google_Trends_Data.xlsx?url";
import keyReturnsUrl from "./assets/Key_Player_Returns.xlsx?url";

export default function Research() {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]); // for the charts (up to 5)

  // Technical & returns inputs from Key_Player_Returns.xlsx
  const [techScores, setTechScores] = useState([]); // [{ player, raw, scaled0to100 }]
  const [rsPoints, setRsPoints] = useState([]); // [{ player, rs3, rs12 }]

  const burntOrange = "#BF5700";

  // -------- Load Google Trends workbook (NBA/MLB/NFL) ----------
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

  // -------- Load Technical Score + RS (3mo/12mo) from Key_Player_Returns.xlsx ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(keyReturnsUrl);
        if (!res.ok) throw new Error(`Failed to fetch Key_Player_Returns.xlsx: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        // Use the first sheet by default
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        if (!ws) throw new Error("Key_Player_Returns sheet not found.");

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Key_Player_Returns sheet is empty.");

        // Find header row with necessary columns
        let headerRowIdx = 0;
        let playerCol = -1;
        let techCol = -1;
        let rs3Col = -1;
        let rs12Col = -1;

        const locateCols = (labelRow) => {
          const lc = labelRow.map((h) =>
            (typeof h === "string" ? h.trim().toLowerCase() : String(h || "").toLowerCase())
          );
          let p = -1, t = -1, r3 = -1, r12 = -1;
          lc.forEach((v, i) => {
            const vComp = v.replace(/\s+/g, "");
            if (p === -1 && vComp.includes("player")) p = i;
            if (t === -1 && /tech/.test(v) && /score/.test(v)) t = i;
            if (r3 === -1 && /(^|[^0-9])3([^0-9a-z]?|[ -]?)m(o|th)?/.test(v) && /rs/.test(v)) r3 = i;
            if (r12 === -1 && /(^|[^0-9])12([^0-9a-z]?|[ -]?)m(o|th)?/.test(v) && /rs/.test(v)) r12 = i;
          });
          return { p, t, r3, r12 };
        };

        for (let i = 0; i < Math.min(5, aoa.length); i++) {
          const { p, t, r3, r12 } = locateCols(aoa[i]);
          if (p !== -1) {
            headerRowIdx = i;
            playerCol = p;
            techCol = t;
            rs3Col = r3;
            rs12Col = r12;
            break;
          }
        }

        if (playerCol === -1) playerCol = 0;

        const tempTech = [];
        const tempRS = [];
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row) continue;
          const player = (row[playerCol] ?? "").toString().trim();
          if (!player) continue;

          // Technical score
          const rawTech = techCol !== -1 ? toFiniteNumber(row[techCol]) : null;
          if (rawTech != null) tempTech.push({ player, raw: rawTech });

          // RS values
          const rs3 = rs3Col !== -1 ? toFiniteNumber(row[rs3Col]) : null;
          const rs12 = rs12Col !== -1 ? toFiniteNumber(row[rs12Col]) : null;
          if (rs3 != null && rs12 != null) tempRS.push({ player, rs3, rs12 });
        }

        // Build scaled technical scores 0–100 (100 = best)
        let scaledTech = [];
        if (tempTech.length) {
          const vals = tempTech.map((d) => d.raw);
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          scaledTech = tempTech.map((d) => {
            let s;
            if (max === min) s = 50;
            else s = Math.round(((d.raw - min) / (max - min)) * 100);
            return { player: d.player, raw: d.raw, scaled0to100: s };
          });
          scaledTech.sort((a, b) => b.scaled0to100 - a.scaled0to100);
        }

        setTechScores(scaledTech);
        setRsPoints(tempRS);
      } catch (e) {
        console.warn(e);
        setTechScores([]);
        setRsPoints([]);
      }
    })();
  }, []);

  // --- Convert "<" strings → 0, parse numbers ---
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

  // Build latest Google Trends rank per player (name without "(LEAGUE)")
  const latestRankMap = useMemo(() => {
    if (!rankedRows.length) return new Map();
    const latest = rankedRows[rankedRows.length - 1] || {};
    const map = new Map();
    columns
      .filter((c) => c !== "Date")
      .forEach((col) => {
        const name = col.replace(/\s*\((NBA|MLB|NFL)\)\s*$/, "").trim();
        map.set(toASCII(name).toLowerCase(), Number.isFinite(latest[col]) ? latest[col] : null);
      });
    return map;
  }, [rankedRows, columns]);

  // Technical list with scaled score (0–100)
  const techScaledList = useMemo(() => {
    return techScores.map((d) => ({
      player: d.player,
      techScaled: d.scaled0to100, // 0–100, 100 best
    }));
  }, [techScores]);

  // Tech (0–100) vs Google Trends Rank (1–100) dataset (players present in both)
  const techVsTrendsScaled = useMemo(() => {
    const out = [];
    for (const t of techScaledList) {
      const key = toASCII(t.player).toLowerCase();
      let g = latestRankMap.get(key);
      if (!Number.isFinite(g)) {
        // fuzzy startsWith match if exact key not found
        for (const [k, v] of latestRankMap.entries()) {
          if (k.startsWith(key) && Number.isFinite(v)) {
            g = v;
            break;
          }
        }
      }
      if (Number.isFinite(g)) out.push({ player: t.player, techScaled: t.techScaled, gRank: g });
    }
    return out;
  }, [techScaledList, latestRankMap]);

  // --- Average(Tech, Trends) vs 3mo RS dataset ---
  const avgScoreVsRS3 = useMemo(() => {
    if (!techVsTrendsScaled.length || !rsPoints.length) return [];
    const rsMap = new Map();
    for (const r of rsPoints) {
      const key = toASCII(r.player).toLowerCase();
      rsMap.set(key, r.rs3);
    }
    const out = [];
    for (const t of techVsTrendsScaled) {
      const key = toASCII(t.player).toLowerCase();
      let rs3 = rsMap.get(key);
      if (!Number.isFinite(rs3)) {
        for (const [k, v] of rsMap.entries()) {
          if (k.startsWith(key) && Number.isFinite(v)) {
            rs3 = v;
            break;
          }
        }
      }
      if (Number.isFinite(rs3)) {
        out.push({
          player: t.player,
          avgScore: (t.techScaled + t.gRank) / 2,
          rs3,
        });
      }
    }
    return out;
  }, [techVsTrendsScaled, rsPoints]);

  // --- Ranked RS dataset (0–100, 100 best) for the RS vs RS scatter ---
  const rsRankedPoints = useMemo(() => {
    if (!rsPoints.length) return [];
    const by3 = [...rsPoints].sort((a, b) => (b.rs3 ?? -Infinity) - (a.rs3 ?? -Infinity));
    const by12 = [...rsPoints].sort((a, b) => (b.rs12 ?? -Infinity) - (a.rs12 ?? -Infinity));
    const n = rsPoints.length;

    const rankScore = (idx) => {
      if (n <= 1) return 50;
      // idx: 0 is best; n-1 is worst -> 100..0
      return Math.round((1 - idx / (n - 1)) * 100);
    };

    const r3map = new Map();
    const r12map = new Map();
    by3.forEach((d, i) => r3map.set(d.player, rankScore(i)));
    by12.forEach((d, i) => r12map.set(d.player, rankScore(i)));

    return rsPoints
      .map((d) => ({
        player: d.player,
        rs3Rank: r3map.get(d.player) ?? null,
        rs12Rank: r12map.get(d.player) ?? null,
      }))
      .filter((d) => Number.isFinite(d.rs3Rank) && Number.isFinite(d.rs12Rank));
  }, [rsPoints]);

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
          textAlign: "center",
        }}
      >
        Technical and Sentiment Research
      </h1>

      {/* 1) Avg(Tech, Trends) vs 3mo RS */}
      <div
        style={{
          marginTop: 6,
          paddingTop: 12,
          paddingBottom: 8,
          borderTop: `2px solid ${burntOrange}`,
          borderBottom: `2px solid ${burntOrange}`,
          background: "#fff",
        }}
      >
        <h2
          style={{
            color: burntOrange,
            margin: "0 0 10px 0",
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          Composite Rank vs 3-Month Relative Strength
        </h2>

        {avgScoreVsRS3.length ? (
          <ScatterAvgScoreVsRS3
            data={avgScoreVsRS3}
            burntOrange={burntOrange}
            width={1280}
            height={400}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#666" }}>
            Could not compute overlap between Technical/Trends and 3-Month RS.
          </div>
        )}
      </div>

      {/* 2) Technical vs Google Trends */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          paddingBottom: 8,
          borderTop: `2px solid ${burntOrange}`,
          borderBottom: `2px solid ${burntOrange}`,
          background: "#fff",
        }}
      >
        <h2
          style={{
            color: burntOrange,
            margin: "0 0 10px 0",
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          Technical Rank (0–100) vs Google Trends Rank
        </h2>

        {techVsTrendsScaled.length ? (
          <ScatterTechScoreVsTrends
            data={techVsTrendsScaled}
            burntOrange={burntOrange}
            width={1280}
            height={420}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#666" }}>
            Insufficient overlap between Technical data and Google Trends names.
          </div>
        )}

        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          Note: Technical is a 0–100 score (100 = strongest). Google Trends Rank is the
          latest-week 1–100 scale (higher = better).
        </div>
      </div>

      {/* 3) 3-Month RS vs 12-Month RS — RANKS (0–100) */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          paddingBottom: 8,
          borderTop: `2px solid ${burntOrange}`,
          borderBottom: `2px solid ${burntOrange}`,
          background: "#fff",
        }}
      >
        <h2
          style={{
            color: burntOrange,
            margin: "0 0 10px 0",
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          3-Month Relative Strength vs 12-Month Relative Strength (Ranks 0–100, 100 = best)
        </h2>

        {rsRankedPoints.length ? (
          <ScatterRS3v12Ranked
            data={rsRankedPoints}
            burntOrange={burntOrange}
            width={1280}
            height={460}
          />
        ) : (
          <div style={{ fontSize: 13, color: "#666" }}>
            Relative Strength (3mo/12mo) not available in file.
          </div>
        )}
      </div>

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
        {
          "Source:  Underlying data sourced from Google Trends.  Calculations by Longhorn Cards convert the data to rankings based on 52- and 156-week moving averages."
        }
      </div>

      {/* Box-Plot moved to the bottom, just above the Home button */}
      <BoxPlotAllPlayers
        rankedRows={rankedRows}
        columns={columns}
        burntOrange={burntOrange}
      />

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
  const [chartLeague] = useState("All"); // reserved for future filtering

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

  // Keep selections valid for current chart filter; if none remain, auto-suggest top 3
  useEffect(() => {
    if (!rankedRows.length) return;

    setSelectedPlayers((prev) => {
      const stillValid = prev.filter((p) => playerOptions.includes(p));
      if (stillValid.length > 0) return stillValid;

      const last = rankedRows[rankedRows.length - 1] || {};
      const candidates = playerOptions
        .map((c) => ({ col: c, val: last[c] }))
        .filter((e) => Number.isFinite(e.val));
      candidates.sort((a, b) => b.val - a.val);
      const suggestions = candidates.slice(0, 3).map((e) => e.col);
      return suggestions;
    });
  }, [playerOptions, rankedRows, setSelectedPlayers]);

  const WIDTH = 900;
  const HEIGHT = 300;
  const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

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

  const latest = rankedRows[rankedRows.length - 1] || {};
  const barData = selectedPlayers.map((col, idx) => ({
    col,
    value: Number.isFinite(latest[col]) ? latest[col] : 0,
    color: COLORS[idx % COLORS.length],
  }));

  const m = Math.max(1, barData.length);
  const band = innerW / m;
  const barW = Math.max(12, band * 0.6);
  const barX = (i) => i * band + (band - barW) / 2;

  return (
    <div
      style={{
        padding: "12px",
        borderTop: `1px solid ${burntOrange}`,
        background: "#fff",
        marginTop: 12,
      }}
    >
      {/* Player selector */}
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 6,
            width: "100%",
            overflow: "visible",
          }}
        >
          {columns
            .filter((c) => c !== "Date")
            .sort((a, b) => a.localeCompare(b))
            .map((p) => {
              const active = selectedPlayers.includes(p);
              const disabled = !active && selectedPlayers.length >= 5;
              return (
                <button
                  key={p}
                  onClick={() => {
                    if (disabled) return;
                    if (active)
                      setSelectedPlayers((prev) => prev.filter((x) => x !== p));
                    else setSelectedPlayers((prev) => [...prev, p]);
                  }}
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
            {Array.from({ length: 8 }).map((_, k) => {
              const i = Math.round((k / 7) * (n - 1));
              const date = rankedRows[i]?.Date;
              return (
                <g key={i} transform={`translate(${xLine(i)},${innerH})`}>
                  <line y1={0} y2={4} stroke="#ccc" />
                  <text y={16} textAnchor="middle" fontSize="10" fill="#777">
                    {date}
                  </text>
                </g>
              );
            })}

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
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t} transform={`translate(0,${yRank(t)})`}>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">
                  {t}
                </text>
              </g>
            ))}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />

            {barData.map((b, i) => {
              const x = barX(i);
              const y = yRank(b.value);
              const h = innerH - y;
              return (
                <g key={b.col} transform={`translate(${x},0)`}>
                  <rect x={0} y={y} width={barW} height={h} fill={b.color} />
                  <text
                    x={barW / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#333"
                  >
                    {Math.round(b.value)}
                  </text>
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

/** --- Utility: simple OLS line (slope & intercept) --- **/
function olsLine(points, getX, getY) {
  const xs = points.map(getX);
  const ys = points.map(getY);
  const n = points.length || 1;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const m = den === 0 ? 0 : num / den;
  const b = my - m * mx;
  return { m, b };
}

/** --- SCATTER: 3mo RS Rank vs 12mo RS Rank (0–100; 100 best) --- **/
function ScatterRS3v12Ranked({ data, burntOrange, width = 1280, height = 460 }) {
  // data: [{ player, rs3Rank, rs12Rank }]
  const M = { top: 32, right: 24, bottom: 52, left: 64 };
  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;

  const x0 = 0, x1 = 100;
  const y0 = 0, y1 = 100;

  const x = (v) => ((v - x0) / (x1 - x0)) * W;
  const y = (v) => H - ((v - y0) / (y1 - y0)) * H;

  const xTicks = [0, 20, 40, 60, 80, 100];
  const yTicks = [0, 20, 40, 60, 80, 100];

  // OLS on ranked data
  const { m, b } = olsLine(data, (d) => d.rs3Rank, (d) => d.rs12Rank);

  return (
    <svg width={width} height={height} role="img" aria-label="3-month RS Rank vs 12-month RS Rank">
      <g transform={`translate(${M.left},${M.top})`}>
        {/* Quadrant backgrounds (screen-based): TL=blue, TR=green, BL=red, BR=yellow */}
        <rect x={0} y={0} width={W / 2} height={H / 2} fill="blue" opacity="0.08" />
        <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="green" opacity="0.08" />
        <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="red" opacity="0.08" />
        <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="yellow" opacity="0.12" />

        {/* Axes */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#ccc" />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#ccc" />

        {xTicks.map((t, i) => (
          <g key={`xt-${i}`} transform={`translate(${x(t)},0)`}>
            <line y1={0} y2={H} stroke="#eee" />
            <text y={H + 18} textAnchor="middle" fontSize="11" fill="#777">
              {t}
            </text>
          </g>
        ))}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`} transform={`translate(0,${y(t)})`}>
            <line x1={0} x2={W} stroke="#eee" />
            <text x={-10} y={4} textAnchor="end" fontSize="11" fill="#777">
              {t}
            </text>
          </g>
        ))}

        {/* Diagonal reference (y=x) */}
        <line x1={0} y1={y(x0)} x2={W} y2={y(x1)} stroke="#ddd" strokeDasharray="4,4" />

        {/* OLS best-fit line */}
        {Number.isFinite(m) && Number.isFinite(b) && (
          <line
            x1={x(x0)}
            y1={y(m * x0 + b)}
            x2={x(x1)}
            y2={y(m * x1 + b)}
            stroke="#444"
            strokeDasharray="6,4"
          />
        )}

        {data.map((d) => {
          const cx = x(d.rs3Rank);
          const cy = y(d.rs12Rank);
          return (
            <g key={d.player} transform={`translate(${cx},${cy})`}>
              <circle r={4} fill={burntOrange} opacity="0.9" />
              <title>{`${d.player}\n3m RS (rank): ${d.rs3Rank}\n12m RS (rank): ${d.rs12Rank}`}</title>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={W / 2} y={H + 36} textAnchor="middle" fontSize="13" fill="#333" fontWeight="700">
          3-Month Relative Strength (Rank 0–100)
        </text>
        <text
          transform="rotate(-90)"
          x={-H / 2}
          y={-50}
          textAnchor="middle"
          fontSize="13"
          fill="#333"
          fontWeight="700"
        >
          12-Month Relative Strength (Rank 0–100)
        </text>
      </g>
    </svg>
  );
}

/** --- NEW SCATTER: Avg(Tech, Trends) vs 3mo RS with best-fit line + quadrants --- **/
function ScatterAvgScoreVsRS3({ data, burntOrange, width = 1280, height = 400 }) {
  // data: [{ player, avgScore (0–100), rs3 }]
  const M = { top: 26, right: 20, bottom: 48, left: 58 };
  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;

  const x0 = 0, x1 = 100;
  const ys = data.map((d) => d.rs3);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const pad = (yMax - yMin) * 0.08 || 1;
  const y0 = yMin - pad;
  const y1 = yMax + pad;

  const x = (v) => ((v - x0) / (x1 - x0)) * W;
  const y = (v) => H - ((v - y0) / (y1 - y0)) * H;

  const ticks = (min, max, n = 5) => {
    if (!isFinite(min) || !isFinite(max) || min === max) return [min];
    const step = (max - min) / n;
    return Array.from({ length: n + 1 }, (_, i) => +(min + i * step).toFixed(2));
  };

  const xTicks = [0, 20, 40, 60, 80, 100];
  const yTicks = ticks(y0, y1, 5);

  // OLS
  const { m, b } = olsLine(data, (d) => d.avgScore, (d) => d.rs3);

  return (
    <svg width={width} height={height} role="img" aria-label="Average of Technical & Google Trends vs 3-Month RS">
      <g transform={`translate(${M.left},${M.top})`}>
        {/* Quadrant backgrounds (screen-based): TL=blue, TR=green, BL=red, BR=yellow */}
        <rect x={0} y={0} width={W / 2} height={H / 2} fill="blue" opacity="0.08" />
        <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="green" opacity="0.08" />
        <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="red" opacity="0.08" />
        <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="yellow" opacity="0.12" />

        {/* Axes */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#ccc" />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#ccc" />

        {xTicks.map((t, i) => (
          <g key={`xt-${i}`} transform={`translate(${x(t)},0)`}>
            <line y1={0} y2={H} stroke="#eee" />
            <text y={H + 16} textAnchor="middle" fontSize="10" fill="#777">
              {t}
            </text>
          </g>
        ))}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`} transform={`translate(0,${y(t)})`}>
            <line x1={0} x2={W} stroke="#eee" />
            <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">
              {t}
            </text>
          </g>
        ))}

        {/* OLS best-fit line */}
        {Number.isFinite(m) && Number.isFinite(b) && (
          <line
            x1={x(x0)}
            y1={y(m * x0 + b)}
            x2={x(x1)}
            y2={y(m * x1 + b)}
            stroke="#444"
            strokeDasharray="6,4"
          />
        )}

        {data.map((d) => {
          const cx = x(d.avgScore);
          const cy = y(d.rs3);
          return (
            <g key={d.player} transform={`translate(${cx},${cy})`}>
              <circle r={3.5} fill={burntOrange} opacity="0.9" />
              <title>{`${d.player}\nAvg(Tech, Trends): ${d.avgScore.toFixed(2)}\n3m RS: ${d.rs3}`}</title>
            </g>
          );
        })}

        <text x={W / 2} y={H + 36} textAnchor="middle" fontSize="12" fill="#333" fontWeight="700">
          Composite Rank (0–100)
        </text>
        {/* y-axis label: on axis, centered along it */}
        <text
          transform="rotate(-90)"
          x={-H / 2}
          y={-46}
          textAnchor="middle"
          fontSize="12"
          fill="#333"
          fontWeight="700"
        >
          3-Month Relative Strength (RS)
        </text>
      </g>
    </svg>
  );
}

/** --- SCATTER: Technical (0–100) vs Google Trends (1–100) with best-fit line + quadrants --- **/
function ScatterTechScoreVsTrends({ data, burntOrange, width = 1280, height = 420 }) {
  // data: [{ player, techScaled (0–100, higher=better), gRank (1–100, higher=better) }]
  const M = { top: 30, right: 20, bottom: 48, left: 60 };
  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;

  const x0 = 0, x1 = 100;
  const y0 = 0, y1 = 100;

  const x = (v) => ((v - x0) / (x1 - x0)) * W;
  const y = (v) => H - ((v - y0) / (y1 - y0)) * H;

  const xTicks = [0, 20, 40, 60, 80, 100];
  const yTicks = [0, 20, 40, 60, 80, 100];

  // OLS
  const { m, b } = olsLine(data, (d) => d.techScaled, (d) => d.gRank);

  const dotColor = (t, g) => {
    if (t >= 66 && g >= 66) return burntOrange;
    if (t >= 50 && g >= 50) return "#2ca02c";
    return "#1f77b4";
  };

  return (
    <svg width={width} height={height} role="img" aria-label="Technical Score vs Google Trends Rank">
      <g transform={`translate(${M.left},${M.top})`}>
        {/* Quadrant backgrounds (screen-based): TL=blue, TR=green, BL=red, BR=yellow */}
        <rect x={0} y={0} width={W / 2} height={H / 2} fill="blue" opacity="0.08" />
        <rect x={W / 2} y={0} width={W / 2} height={H / 2} fill="green" opacity="0.08" />
        <rect x={0} y={H / 2} width={W / 2} height={H / 2} fill="red" opacity="0.08" />
        <rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill="yellow" opacity="0.12" />

        {/* Axes */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#ccc" />
        <line x1={0} y1={0} x2={0} y2={H} stroke="#ccc" />

        {xTicks.map((t, i) => (
          <g key={`xt-${i}`} transform={`translate(${x(t)},0)`}>
            <line y1={0} y2={H} stroke="#eee" />
            <text y={H + 16} textAnchor="middle" fontSize="10" fill="#777">
              {t}
            </text>
          </g>
        ))}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`} transform={`translate(0,${y(t)})`}>
            <line x1={0} x2={W} stroke="#eee" />
            <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">
              {t}
            </text>
          </g>
        ))}

        {/* OLS best-fit line */}
        {Number.isFinite(m) && Number.isFinite(b) && (
          <line
            x1={x(x0)}
            y1={y(m * x0 + b)}
            x2={x(x1)}
            y2={y(m * x1 + b)}
            stroke="#444"
            strokeDasharray="6,4"
          />
        )}

        {data.map((d) => {
          const cx = x(d.techScaled);
          const cy = y(d.gRank);
          return (
            <g key={d.player} transform={`translate(${cx},${cy})`}>
              <circle r={3.5} fill={dotColor(d.techScaled, d.gRank)} opacity="0.9" />
              <title>{`${d.player}\nTechnical (0–100): ${d.techScaled}\nGoogle Trends Rank: ${Math.round(d.gRank)}`}</title>
            </g>
          );
        })}

        <text x={W / 2} y={H + 36} textAnchor="middle" fontSize="12" fill="#333" fontWeight="700">
          Technical Rank (0–100, 100 = strongest)
        </text>
        {/* y-axis label: on axis, centered along it */}
        <text
          transform="rotate(-90)"
          x={-H / 2}
          y={-48}
          textAnchor="middle"
          fontSize="12"
          fill="#333"
          fontWeight="700"
        >
          Google Trends Rank (latest, 1–100)
        </text>
      </g>
    </svg>
  );
}

/** --- Box-Plot (Full Roster) — with sorting & league filters --- **/
function BoxPlotAllPlayers({ rankedRows, columns, burntOrange }) {
  const [boxLeague, setBoxLeague] = useState("All");

  const allPlayerCols = useMemo(
    () => columns.filter((c) => c !== "Date"),
    [columns]
  );

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

    return unsorted.sort((a, b) => {
      const av = a.cur ?? -Infinity;
      const bv = b.cur ?? -Infinity;
      return bv - av;
    });
  }, [playerCols, rankedRows]);

  const LABEL_W = 240;
  const WIDTH = 1100;
  const RIGHT_M = 20;
  const INNER_W = WIDTH - LABEL_W - RIGHT_M;
  const TOP_M = 58;
  const ROW_H = 28;
  const H = TOP_M + statsSorted.length * ROW_H + 24;

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
          Box Plots for Google Trends Rankings (Ranks 1–100)
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
                <text
                  x={LABEL_W - 8}
                  y={yMid + 3}
                  textAnchor="end"
                  fontSize="12"
                  fill="#333"
                >
                  {s.col}
                </text>

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
                  <line
                    x1={xMed}
                    x2={xMed}
                    y1={yBoxTop}
                    y2={yBoxTop + yBoxH}
                    stroke="#333"
                    strokeWidth={2}
                  />
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

function toFiniteNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Remove accent marks & standardize to ASCII
function toASCII(s) {
  if (typeof s !== "string") return s;
  let out = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
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
