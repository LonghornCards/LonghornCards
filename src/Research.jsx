// src/Research.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

// Assets
import trendsUrl from "./assets/Google_Trends_Ranks.xlsx?url";
import keyReturnsUrl from "./assets/Key_Player_Returns.xlsx?url";
import fundamentalsUrl from "./assets/Key_Player_Fundamentals.xlsx?url";

// Charts
import LineChartSection from "./charts/LineChartSection.jsx";
import UnifiedScatter from "./charts/UnifiedScatter.jsx";
import BoxPlotAllPlayers from "./charts/BoxPlotAllPlayers.jsx";

// Utils
import {
  parseMonthHeader,
  toFiniteNumber,
  toASCII,
  titleCaseFromKey,
  sportToLeague,
} from "./utils/chartUtils";

export default function Research() {
  const [rows, setRows] = useState([]);       // full time-series rows: [{Date, "Player (LEAGUE)": rank, ...}, ...]
  const [columns, setColumns] = useState([]); // ["Date", "Player (LEAGUE)", ...]
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const [techScores, setTechScores] = useState([]); // [{ player, raw, scaled0to100 }]
  const [rsPoints, setRsPoints] = useState([]);     // [{ player, rs3, rs12 }]
  const [fundamentals, setFundamentals] = useState([]); // [{ player, fundRank, fundChange }]
  const burntOrange = "#BF5700";

  // -------- Load MONTHLY Google Trends RANKS workbook (entire time series) ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(trendsUrl);
        if (!res.ok) throw new Error(`Failed to fetch Google_Trends_Ranks.xlsx: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        if (!ws) throw new Error("Google_Trends_Ranks sheet not found.");

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Google_Trends_Ranks sheet is empty.");

        let headerRowIdx = 0;
        let playerCol = -1;
        let sportCol = -1;

        const findHeader = (row) => {
          const norm = row.map((h) =>
            (typeof h === "string" ? h.trim().toLowerCase() : String(h ?? "").toLowerCase())
          );
          let p = -1,
            s = -1;
          norm.forEach((v, i) => {
            const vComp = v.replace(/\s+/g, "");
            if (p === -1 && vComp.includes("player")) p = i;
            if (s === -1 && vComp.includes("sport")) s = i;
          });
          return { p, s };
        };

        for (let i = 0; i < Math.min(5, aoa.length); i++) {
          const { p, s } = findHeader(aoa[i]);
          if (p !== -1 && s !== -1) {
            headerRowIdx = i;
            playerCol = p;
            sportCol = s;
            break;
          }
        }
        if (playerCol === -1 || sportCol === -1)
          throw new Error("Could not locate 'Player' and 'Sport' columns in Google_Trends_Ranks.");

        const headers = aoa[headerRowIdx];
        let firstMonthCol = Math.min(playerCol, sportCol) + 1;
        while (firstMonthCol < headers.length && [playerCol, sportCol].includes(firstMonthCol))
          firstMonthCol++;

        const monthCols = [];
        for (let c = firstMonthCol; c < headers.length; c++) {
          const label = headers[c];
          const iso = parseMonthHeader(label);
          if (iso) monthCols.push([c, iso]);
        }
        if (!monthCols.length)
          throw new Error("No monthly date columns recognized in Google_Trends_Ranks header.");

        const colOrder = ["Date"];
        const rowMap = new Map();

        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row) continue;
          const playerRaw = (row[playerCol] ?? "").toString().trim();
          const sportRaw = (row[sportCol] ?? "").toString().trim();
          if (!playerRaw) continue;

          const cleanedName = toASCII(
            playerRaw.replace(/\s*\([^)]*\)\s*$/g, "").trim()
          );
          const league = sportToLeague(sportRaw);
          const label = league ? `${cleanedName} (${league})` : cleanedName;

          if (!colOrder.includes(label)) colOrder.push(label);

          for (const [cIdx, iso] of monthCols) {
            const v = toFiniteNumber(row[cIdx]);
            if (v == null) continue;
            if (!rowMap.has(iso)) rowMap.set(iso, { Date: iso });
            const rec = rowMap.get(iso);
            rec[label] = v;
          }
        }

        const mergedRows = [...rowMap.values()].sort((a, b) =>
          a.Date.localeCompare(b.Date)
        );
        setColumns(colOrder);
        setRows(mergedRows);
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
  }, []);

  // -------- Load Technical Score + RS (3mo/12mo) ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(keyReturnsUrl);
        if (!res.ok) throw new Error(`Failed to fetch Key_Player_Returns.xlsx: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error("Key_Player_Returns sheet not found.");
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Key_Player_Returns sheet is empty.");

        let headerRowIdx = 0,
          playerCol = -1,
          techCol = -1,
          rs3Col = -1,
          rs12Col = -1;
        const locateCols = (labelRow) => {
          const lc = labelRow.map((h) =>
            (typeof h === "string" ? h.trim().toLowerCase() : String(h || "").toLowerCase())
          );
          let p = -1,
            t = -1,
            r3 = -1,
            r12 = -1;
          lc.forEach((v, i) => {
            const vComp = v.replace(/\s+/g, "");
            if (p === -1 && vComp.includes("player")) p = i;
            if (t === -1 && /tech/.test(v) && /score/.test(v)) t = i;
            if (r3 === -1 && /(^|[^0-9])3([^0-9a-z]?|[ -]?)m(o|th)?/.test(v) && /rs/.test(v))
              r3 = i;
            if (r12 === -1 && /(^|[^0-9])12([^0-9a-z]?|[ -]?)m(o|th)?/.test(v) && /rs/.test(v))
              r12 = i;
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
          const rawTech = techCol !== -1 ? toFiniteNumber(row[techCol]) : null;
          if (rawTech != null) tempTech.push({ player, raw: rawTech });

          const rs3 = rs3Col !== -1 ? toFiniteNumber(row[rs3Col]) : null;
          const rs12 = rs12Col !== -1 ? toFiniteNumber(row[rs12Col]) : null;
          if (rs3 != null && rs12 != null) tempRS.push({ player, rs3, rs12 });
        }

        let scaledTech = [];
        if (tempTech.length) {
          const vals = tempTech.map((d) => d.raw);
          const min = Math.min(...vals),
            max = Math.max(...vals);
          scaledTech = tempTech
            .map((d) => {
              let s = max === min ? 50 : Math.round(((d.raw - min) / (max - min)) * 100);
              return { player: d.player, raw: d.raw, scaled0to100: s };
            })
            .sort((a, b) => b.scaled0to100 - a.scaled0to100);
        }

        setTechScores(scaledTech);
        setRsPoints(tempRS);
      } catch {
        setTechScores([]);
        setRsPoints([]);
      }
    })();
  }, []);

  // -------- Load Fundamentals ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(fundamentalsUrl);
        if (!res.ok)
          throw new Error(`Failed to fetch Key_Player_Fundamentals.xlsx: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error("Key_Player_Fundamentals sheet not found.");
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Key_Player_Fundamentals sheet is empty.");

        let headerRowIdx = 0,
          playerCol = -1,
          fundRankCol = -1,
          fundChangeCol = -1;
        const findCols = (row) => {
          const lc = row.map((h) =>
            (typeof h === "string" ? h.trim().toLowerCase() : String(h ?? "").toLowerCase())
          );
          let p = -1,
            fr = -1,
            fc = -1;
          lc.forEach((v, i) => {
            const vComp = v.replace(/\s+/g, "");
            if (p === -1 && vComp.includes("player")) p = i;
            if (fr === -1 && /fund/.test(v) && /(rank|score)/.test(v)) fr = i;
            if (fc === -1 && /fund/.test(v) && /(change|delta|Δ|∆|chg)/.test(v)) fc = i;
            if (fc === -1 && /(change|delta|Δ|∆|chg)/.test(v) && !/price/i.test(v)) fc = i;
          });
          return { p, fr, fc };
        };
        for (let i = 0; i < Math.min(6, aoa.length); i++) {
          const { p, fr, fc } = findCols(aoa[i]);
          if (p !== -1) {
            headerRowIdx = i;
            playerCol = p;
            fundRankCol = fr;
            fundChangeCol = fc;
            break;
          }
        }
        if (playerCol === -1) playerCol = 0;

        const tmp = [];
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row) continue;
          const player = (row[playerCol] ?? "").toString().trim();
          if (!player) continue;
          const fundRank = fundRankCol !== -1 ? toFiniteNumber(row[fundRankCol]) : null;
          const fundChange = fundChangeCol !== -1 ? toFiniteNumber(row[fundChangeCol]) : null;
          if (fundRank != null || fundChange != null)
            tmp.push({ player, fundRank: fundRank ?? null, fundChange: fundChange ?? null });
        }
        setFundamentals(tmp);
      } catch {
        setFundamentals([]);
      }
    })();
  }, []);

  // ---- Derived maps/data for scatter ----
  const rankedRows = rows; // <— single declaration (fix)

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

  const techScaledList = useMemo(
    () => techScores.map((d) => ({ player: d.player, techScaled: d.scaled0to100 })),
    [techScores]
  );

  const rsRankedPoints = useMemo(() => {
    if (!rsPoints.length) return [];
    const by3 = [...rsPoints].sort(
      (a, b) => (b.rs3 ?? -Infinity) - (a.rs3 ?? -Infinity)
    );
    const by12 = [...rsPoints].sort(
      (a, b) => (b.rs12 ?? -Infinity) - (a.rs12 ?? -Infinity)
    );
    const n = rsPoints.length;
    const rankScore = (idx) => (n <= 1 ? 50 : Math.round((1 - idx / (n - 1)) * 100));
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

  const latestInfoMap = useMemo(() => {
    if (!rankedRows.length) return new Map();
    const latest = rankedRows[rankedRows.length - 1] || {};
    const map = new Map();
    columns
      .filter((c) => c !== "Date")
      .forEach((col) => {
        const m = col.match(/\s*\((NBA|MLB|NFL)\)\s*$/);
        const league = m ? m[1] : null;
        const baseName = col.replace(/\s*\((NBA|MLB|NFL)\)\s*$/, "").trim();
        const key = toASCII(baseName).toLowerCase();
        const gRank = Number.isFinite(latest[col]) ? latest[col] : null;
        if (!map.has(key) || (gRank != null && map.get(key)?.gRank == null)) {
          map.set(key, { gRank, league });
        }
      });
    return map;
  }, [rankedRows, columns]);

  const fundamentalMap = useMemo(() => {
    const map = new Map();
    for (const f of fundamentals) {
      const key = toASCII(f.player).toLowerCase();
      map.set(key, {
        fundRank: Number.isFinite(f.fundRank) ? f.fundRank : null,
        fundChange: Number.isFinite(f.fundChange) ? f.fundChange : null,
      });
    }
    return map;
  }, [fundamentals]);

  const returnsKeySet = useMemo(() => {
    const s = new Set();
    for (const d of techScores) s.add(toASCII(d.player).toLowerCase());
    for (const d of rsPoints) s.add(toASCII(d.player).toLowerCase());
    return s;
  }, [techScores, rsPoints]);

  const unifiedData = useMemo(() => {
    const techMap = new Map(
      techScaledList.map((d) => [toASCII(d.player).toLowerCase(), d.techScaled])
    );
    const rsMap = new Map(
      rsPoints.map((d) => [toASCII(d.player).toLowerCase(), { rs3: d.rs3, rs12: d.rs12 }])
    );
    const rsRankMap = new Map(
      rsRankedPoints.map((d) => [
        toASCII(d.player).toLowerCase(),
        { rs3Rank: d.rs3Rank, rs12Rank: d.rs12Rank },
      ])
    );
    const keys = new Set([...returnsKeySet]);

    const out = [];
    for (const k of keys) {
      const techScaled = techMap.get(k) ?? null;
      const rs = rsMap.get(k) ?? {};
      const ranks = rsRankMap.get(k) ?? {};
      const info = latestInfoMap.get(k) ?? {};
      const fund = fundamentalMap.get(k) ?? {};

      const gRank = info?.gRank ?? null;
      const league = info?.league ?? null;
      const fundRank = fund?.fundRank ?? null;
      const fundChange = fund?.fundChange ?? null;

      const comp2src =
        Number.isFinite(techScaled) && Number.isFinite(gRank)
          ? (techScaled + gRank) / 2
          : null;
      const comp3src =
        Number.isFinite(comp2src) && Number.isFinite(fundRank)
          ? (2 * comp2src) / 3 + fundRank / 3
          : null;

      out.push({
        player: titleCaseFromKey(k),
        league,
        techScaled,
        gRank,
        comp2src,
        comp3src,
        fundRank,
        fundChange,
        rs3: Number.isFinite(rs.rs3) ? rs.rs3 : null,
        rs12: Number.isFinite(rs.rs12) ? rs.rs12 : null,
        rs3Rank: ranks.rs3Rank ?? null,
        rs12Rank: ranks.rs12Rank ?? null,
      });
    }

    return out.filter((d) =>
      [
        d.techScaled,
        d.gRank,
        d.comp2src,
        d.comp3src,
        d.fundRank,
        d.fundChange,
        d.rs3,
        d.rs12,
        d.rs3Rank,
        d.rs12Rank,
      ].some(Number.isFinite)
    );
  }, [
    techScaledList,
    rsPoints,
    rsRankedPoints,
    latestInfoMap,
    fundamentalMap,
    returnsKeySet,
  ]);

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
        Research: Fundamental, Technical & Sentiment
      </h1>

      {/* --- Unified Scatter --- */}
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
          style={{ color: burntOrange, margin: "0 0 10px 0", fontSize: 20, fontWeight: 800 }}
        >
          Composite Scatter — Choose X/Y and League
        </h2>

        <UnifiedScatter data={unifiedData} burntOrange={burntOrange} />

        <div style={{ fontSize: 12, color: "#666", marginTop: 6, whiteSpace: "pre-wrap" }}>
{`Gestures:
• Touch: pinch with two fingers to zoom; drag while pinching to focus on an area.
• Mouse: scroll wheel to zoom at cursor; click-drag to draw a box and zoom to it.
• Double-click or use "Reset Zoom" to go back.

Variables available:
- Technical Rank (0–100; higher = better)
- Google Trends Rank (latest, 1–100; higher = better)
- Composite Rank (Tech & Google avg) — 2-source
- Composite Rank (2/3 of prior + 1/3 Fundamental) — 3-source
- Fundamental Rank (0–100; higher = better)
- Fundamental Change (Δ; can be negative/positive)
- 3-Month RS (raw)
- 12-Month RS (raw)
- 3-Month RS Rank (0–100; higher = better)
- 12-Month RS Rank (0–100; higher = better)
`}
        </div>
      </div>

      {/* --- Line chart section --- */}
      <LineChartSection
        rankedRows={rankedRows}
        columns={columns}
        selectedPlayers={selectedPlayers}
        setSelectedPlayers={setSelectedPlayers}
        burntOrange={burntOrange}
      />

      {/* Disclosure */}
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
          "Source:  Underlying data sourced from Google Trends.  Calculations by Longhorn Cards transform the data into sentiment rankings."
        }
      </div>

      {/* --- Box plot section --- */}
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
