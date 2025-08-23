// src/Research.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
// ✅ Monthly Google Trends ranks
import trendsUrl from "./assets/Google_Trends_Ranks.xlsx?url";
import keyReturnsUrl from "./assets/Key_Player_Returns.xlsx?url";
// ✅ Fundamentals (Rank + Change)
import fundamentalsUrl from "./assets/Key_Player_Fundamentals.xlsx?url";

export default function Research() {
  const [rows, setRows] = useState([]);       // Monthly Google Trends RANKS rows
  const [columns, setColumns] = useState([]); // ["Date", "Player (LEAGUE)", ...]
  const [error, setError] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]); // for the charts

  // Technical & returns inputs from Key_Player_Returns.xlsx
  const [techScores, setTechScores] = useState([]); // [{ player, raw, scaled0to100 }]
  const [rsPoints, setRsPoints] = useState([]);     // [{ player, rs3, rs12 }]

  // Fundamentals from Key_Player_Fundamentals.xlsx
  const [fundamentals, setFundamentals] = useState([]); // [{ player, fundRank, fundChange }]

  const burntOrange = "#BF5700";

  // -------- Load MONTHLY Google Trends RANKS workbook ----------
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

        // Find header row with "Player" and "Sport"
        let headerRowIdx = 0;
        let playerCol = -1;
        let sportCol = -1;

        const findHeader = (row) => {
          const norm = row.map((h) => (typeof h === "string" ? h.trim().toLowerCase() : String(h ?? "").toLowerCase()));
          let p = -1, s = -1;
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
        if (playerCol === -1 || sportCol === -1) {
          throw new Error("Could not locate 'Player' and 'Sport' columns in Google_Trends_Ranks.");
        }

        const headers = aoa[headerRowIdx];

        // Month columns = everything after the Player/Sport columns
        let firstMonthCol = Math.min(playerCol, sportCol) + 1;
        while (firstMonthCol < headers.length && [playerCol, sportCol].includes(firstMonthCol)) {
          firstMonthCol++;
        }

        // Build a list of [colIndex, isoDate] for all month columns
        const monthCols = [];
        for (let c = firstMonthCol; c < headers.length; c++) {
          const label = headers[c];
          const iso = parseMonthHeader(label);
          if (iso) monthCols.push([c, iso]);
        }
        if (!monthCols.length) {
          throw new Error("No monthly date columns recognized in Google_Trends_Ranks header.");
        }

        const colOrder = ["Date"];
        const rowMap = new Map(); // key: ISO "YYYY-MM-DD" => { Date, "Player (LEAGUE)": rank }

        // Iterate player rows
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row) continue;

          const playerRaw = (row[playerCol] ?? "").toString().trim();
          const sportRaw = (row[sportCol] ?? "").toString().trim();
          if (!playerRaw) continue;

          // Clean name and attach league
          const cleanedName = toASCII(playerRaw.replace(/\s*\([^)]*\)\s*$/g, "").trim());
          const league = sportToLeague(sportRaw); // "NFL" | "NBA" | "MLB" | ""
          const label = league ? `${cleanedName} (${league})` : cleanedName;

          if (!colOrder.includes(label)) colOrder.push(label);

          // Values per month
          for (const [cIdx, iso] of monthCols) {
            const v = toFiniteNumber(row[cIdx]);
            if (v == null) continue;
            if (!rowMap.has(iso)) rowMap.set(iso, { Date: iso });
            const rec = rowMap.get(iso);
            rec[label] = v;
          }
        }

        const mergedRows = [...rowMap.values()].sort((a, b) => a.Date.localeCompare(b.Date));

        setColumns(colOrder);
        setRows(mergedRows);
      } catch (e) {
        setError(e.message || String(e));
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

        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        if (!ws) throw new Error("Key_Player_Returns sheet not found.");

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Key_Player_Returns sheet is empty.");

        // Find columns
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

          const rawTech = techCol !== -1 ? toFiniteNumber(row[techCol]) : null;
          if (rawTech != null) tempTech.push({ player, raw: rawTech });

          const rs3 = rs3Col !== -1 ? toFiniteNumber(row[rs3Col]) : null;
          const rs12 = rs12Col !== -1 ? toFiniteNumber(row[rs12Col]) : null;
          if (rs3 != null && rs12 != null) tempRS.push({ player, rs3, rs12 });
        }

        // Scaled technical scores 0–100
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
      } catch {
        setTechScores([]);
        setRsPoints([]);
      }
    })();
  }, []);

  // -------- Load Fundamentals (Fundamental Rank + Fundamental Change) ----------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(fundamentalsUrl);
        if (!res.ok) throw new Error(`Failed to fetch Key_Player_Fundamentals.xlsx: ${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        if (!ws) throw new Error("Key_Player_Fundamentals sheet not found.");

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!aoa.length) throw new Error("Key_Player_Fundamentals sheet is empty.");

        let headerRowIdx = 0;
        let playerCol = -1;
        let fundRankCol = -1;
        let fundChangeCol = -1;

        const findCols = (row) => {
          const lc = row.map((h) =>
            (typeof h === "string" ? h.trim().toLowerCase() : String(h ?? "").toLowerCase())
          );
          let p = -1, fr = -1, fc = -1;
          lc.forEach((v, i) => {
            const vComp = v.replace(/\s+/g, "");
            if (p === -1 && vComp.includes("player")) p = i;

            // Fundamental Rank candidates
            if (fr === -1 && /fund/.test(v) && /(rank|score)/.test(v)) fr = i;

            // Fundamental Change candidates (change/delta/Δ)
            if (fc === -1 && (/fund/.test(v) && /(change|delta|Δ|∆|chg)/.test(v))) fc = i;
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
          if (fundRank != null || fundChange != null) {
            tmp.push({ player, fundRank: fundRank ?? null, fundChange: fundChange ?? null });
          }
        }
        setFundamentals(tmp);
      } catch {
        setFundamentals([]);
      }
    })();
  }, []);

  // With monthly ranks, pass straight through as "rankedRows"
  const rankedRows = rows;

  // Latest Google Trends rank per player (name without "(LEAGUE)")
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

  const techVsTrendsScaled = useMemo(() => {
    const out = [];
    for (const t of techScaledList) {
      const key = toASCII(t.player).toLowerCase();
      let g = latestRankMap.get(key);
      if (!Number.isFinite(g)) {
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

  const avgScoreVsRS3 = useMemo(() => {
    if (!techVsTrendsScaled.length || !rsPoints.length) return [];
    const rsMap = new Map(rsPoints.map((r) => [toASCII(r.player).toLowerCase(), r.rs3]));
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
      if (Number.isFinite(rs3)) out.push({ player: t.player, avgScore: (t.techScaled + t.gRank) / 2, rs3 });
    }
    return out;
  }, [techVsTrendsScaled, rsPoints]);

  const rsRankedPoints = useMemo(() => {
    if (!rsPoints.length) return [];
    const by3 = [...rsPoints].sort((a, b) => (b.rs3 ?? -Infinity) - (a.rs3 ?? -Infinity));
    const by12 = [...rsPoints].sort((a, b) => (b.rs12 ?? -Infinity) - (a.rs12 ?? -Infinity));
    const n = rsPoints.length;
    const rankScore = (idx) => (n <= 1 ? 50 : Math.round((1 - idx / (n - 1)) * 100));
    const r3map = new Map();
    const r12map = new Map();
    by3.forEach((d, i) => r3map.set(d.player, rankScore(i)));
    by12.forEach((d, i) => r12map.set(d.player, rankScore(i)));
    return rsPoints
      .map((d) => ({ player: d.player, rs3Rank: r3map.get(d.player) ?? null, rs12Rank: r12map.get(d.player) ?? null }))
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

  // Fundamentals map
  const fundamentalMap = useMemo(() => {
    const map = new Map();
    for (const f of fundamentals) {
      const key = toASCII(f.player).toLowerCase();
      map.set(key, { fundRank: Number.isFinite(f.fundRank) ? f.fundRank : null, fundChange: Number.isFinite(f.fundChange) ? f.fundChange : null });
    }
    return map;
  }, [fundamentals]);

  const unifiedData = useMemo(() => {
    const techMap = new Map(techScaledList.map((d) => [toASCII(d.player).toLowerCase(), d.techScaled]));
    const rsMap = new Map(rsPoints.map((d) => [toASCII(d.player).toLowerCase(), { rs3: d.rs3, rs12: d.rs12 }]));
    const rsRankMap = new Map(rsRankedPoints.map((d) => [toASCII(d.player).toLowerCase(), { rs3Rank: d.rs3Rank, rs12Rank: d.rs12Rank }]));
    const keys = new Set([
      ...techMap.keys(),
      ...rsMap.keys(),
      ...rsRankMap.keys(),
      ...latestInfoMap.keys(),
      ...fundamentalMap.keys(),
    ]);

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

      // 2-source composite (tech & google)
      const comp2src = Number.isFinite(techScaled) && Number.isFinite(gRank) ? (techScaled + gRank) / 2 : null;
      // 3-source composite: 2/3 of prior composite + 1/3 fundamental rank
      const comp3src =
        Number.isFinite(comp2src) && Number.isFinite(fundRank)
          ? (2 * comp2src) / 3 + fundRank / 3
          : null;

      out.push({
        player: titleCaseFromKey(k),
        league,
        techScaled,
        gRank,
        comp2src,                 // previous Composite Rank
        comp3src,                 // NEW 3-source Composite Rank
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
  }, [techScaledList, rsPoints, rsRankedPoints, latestInfoMap, fundamentalMap]);

  if (error) {
    return (
      <div style={{ color: burntOrange, border: `2px solid ${burntOrange}`, padding: 12, borderRadius: 8 }}>
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ padding: 12, color: burntOrange, border: `2px dashed ${burntOrange}`, borderRadius: 8 }}>
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
         Research:  Fundamental, Technical & Sentiment
      </h1>

      {/* --- Unified Scatterplot (now with pinch + box zoom) --- */}
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
        <h2 style={{ color: burntOrange, margin: "0 0 10px 0", fontSize: 20, fontWeight: 800 }}>
          Composite Scatter — Choose X/Y and League
        </h2>

        {/* ⬇︎ Full-width & interactive (pinch, wheel, box-zoom) */}
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

      {/* CHARTS ONLY (table removed for performance) */}
      <ChartSection
        rankedRows={rankedRows}
        columns={columns}
        selectedPlayers={selectedPlayers}
        setSelectedPlayers={setSelectedPlayers}
        burntOrange={burntOrange}
      />

      {/* Disclosure */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#666", textAlign: "left", whiteSpace: "pre-wrap" }}>
        {"Source:  Underlying data sourced from Google Trends.  Calculations by Longhorn Cards transform the data into sentiment rankings."}
      </div>

      {/* ⬇︎ Box Plot now full-width & responsive */}
      <BoxPlotAllPlayers rankedRows={rankedRows} columns={columns} burntOrange={burntOrange} />

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

/** --- Multi-Select (searchable, unlimited by default) --- **/
function MultiSelect({
  options,
  selected,
  onChange,
  max = null, // ⬅ unlimited when null
  color = "#BF5700",
  placeholder = "Search & select players…",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const norm = (s) => (s || "").toLowerCase();
  const filtered = useMemo(() => {
    const q = norm(query);
    const base = q ? options.filter((o) => norm(o).includes(q)) : options;
    // keep selected at top, then matches
    const sel = new Set(selected);
    return base.filter((o) => sel.has(o)).concat(base.filter((o) => !sel.has(o))).slice(0, 1000);
  }, [options, selected, query]);

  const hasLimit = max != null && Number.isFinite(max);
  const atLimit = hasLimit && selected.length >= max;

  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else if (!atLimit) {
      onChange([...selected, opt]);
    }
  };
  const remove = (opt) => onChange(selected.filter((s) => s !== opt));

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Combobox */}
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          minHeight: 40,
          width: "100%",
          border: `1px solid ${color}`,
          borderRadius: 10,
          padding: "6px 10px",
          background: "#fff",
          cursor: "text",
        }}
      >
        {/* Selected pills */}
        {selected.map((s) => (
          <span
            key={s}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              border: `1px solid ${color}`,
              background: color,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "4px 8px",
            }}
          >
            {s}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(s);
              }}
              aria-label={`Remove ${s}`}
              style={{
                border: "none",
                background: "transparent",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}

        {/* Search input */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : placeholder}
          style={{
            flex: 1,
            minWidth: 140,
            border: "none",
            outline: "none",
            fontSize: 13,
            padding: "4px 2px",
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: 10, fontSize: 12, color: "#777" }}>No matches</div>
          )}

          {filtered.map((opt) => {
            const isSel = selected.includes(opt);
            const disabled = !isSel && atLimit;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                disabled={disabled}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  background: isSel ? "#f7f7f7" : "#fff",
                  border: "none",
                  borderBottom: "1px solid #f1f1f1",
                  cursor: disabled ? "not-allowed" : "pointer",
                  color: disabled ? "#bbb" : "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <input type="checkbox" checked={isSel} readOnly style={{ pointerEvents: "none" }} />
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Helper row */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <small style={{ color: "#777" }}>
          {selected.length}{hasLimit ? `/${max}` : ""} selected
        </small>
        {atLimit && <small style={{ color, fontWeight: 700 }}>Limit reached</small>}
      </div>
    </div>
  );
}

/** --- Line Chart Section (BAR REMOVED, LINE IS FULL-WIDTH) --- **/
function ChartSection({ rankedRows, columns, selectedPlayers, setSelectedPlayers, burntOrange }) {
  const [chartLeague] = useState("All"); // reserved for future filtering
  const parseCol = (c) => {
    const m = c.match(/^(.*)\s\((NBA|MLB|NFL)\)$/);
    return { name: (m?.[1] || c).trim(), league: m?.[2] || "" };
  };
  const leagueOrder = { MLB: 0, NBA: 1, NFL: 2 };

  const playerOptions = useMemo(() => {
    const all = columns.filter((c) => c !== "Date");
    const base = chartLeague === "All" ? all : all.filter((c) => c.endsWith(`(${chartLeague})`));
    const sorted = [...base].sort((a, b) => {
      const pa = parseCol(a);
      const pb = parseCol(b);
      if (chartLeague === "All") {
        const cmpL = (leagueOrder[pa.league] ?? 99) - (leagueOrder[pb.league] ?? 99);
        if (cmpL !== 0) return cmpL;
      }
      return pa.name.localeCompare(pb.name);
    });
    return sorted;
  }, [columns, chartLeague]);

  // Keep selections valid; if empty, auto-suggest top 3 latest
  useEffect(() => {
    if (!rankedRows.length) return;
    setSelectedPlayers((prev) => {
      const stillValid = prev.filter((p) => playerOptions.includes(p));
      if (stillValid.length > 0) return stillValid;
      const last = rankedRows[rankedRows.length - 1] || {};
      const candidates = playerOptions.map((c) => ({ col: c, val: last[c] })).filter((e) => Number.isFinite(e.val));
      candidates.sort((a, b) => b.val - a.val);
      return candidates.slice(0, 3).map((e) => e.col);
    });
  }, [playerOptions, rankedRows, setSelectedPlayers]);

  // Make the line chart full-width of its container
  const [wrapRef, widthPx] = useContainerWidth(680); // min width for a pleasant layout
  const WIDTH = widthPx;
  const HEIGHT = 340;
  const MARGIN = { top: 20, right: 20, bottom: 40, left: 46 };
  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const n = rankedRows.length;
  const xLine = (i) => (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yRank = (v) => innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const COLORS = [
    "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
    "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"
  ];

  const linePaths = useMemo(() => {
    const makePathD = (col) => {
      let d = "";
      for (let i = 0; i < n; i++) {
        const v = rankedRows[i][col];
        if (v == null || Number.isNaN(v)) continue;
        const px = xLine(i);
        const py = yRank(v);
        d += d ? ` L ${px} ${py}` : `M ${px} ${py}`;
      }
      return d;
    };
    return selectedPlayers.map((col, idx) => ({ col, d: makePathD(col), color: COLORS[idx % COLORS.length] }));
  }, [selectedPlayers, rankedRows, n]);

  return (
    <div style={{ padding: "12px", borderTop: `1px solid ${burntOrange}`, background: "#fff", marginTop: 12 }}>
      {/* Multi-Selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ color: burntOrange, fontWeight: 700 }}>Choose players:</span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <MultiSelect
            options={playerOptions}
            selected={selectedPlayers}
            onChange={setSelectedPlayers}
            color={burntOrange}
            placeholder="Search & select players…"
          />
        </div>
      </div>

      {/* Legend */}
      {selectedPlayers.length > 0 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "6px 0 8px 0" }}>
          {selectedPlayers.map((col, idx) => (
            <div key={col} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 18, height: 4, background: COLORS[idx % COLORS.length], borderRadius: 2 }} />
              <span style={{ fontSize: 12 }}>{col}</span>
            </div>
          ))}
        </div>
      )}

      {/* Full-width Line Chart */}
      <div ref={wrapRef} style={{ width: "100%" }}>
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Player comparison line chart">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Axes */}
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t} transform={`translate(0,${yRank(t)})`}>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">{t}</text>
              </g>
            ))}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />

            {/* X ticks (sample across the series) */}
            {Array.from({ length: 8 }).map((_, k) => {
              const i = Math.round((k / 7) * (n - 1));
              const date = rankedRows[i]?.Date;
              return (
                <g key={i} transform={`translate(${xLine(i)},${innerH})`}>
                  <line y1={0} y2={4} stroke="#ccc" />
                  <text y={16} textAnchor="middle" fontSize="10" fill="#777">{date}</text>
                </g>
              );
            })}

            {/* Lines */}
            {linePaths.map((p) => (
              <path key={p.col} d={p.d} fill="none" stroke={p.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** --- Unified Scatter (FULL-WIDTH responsive) + Pinch / Wheel / Box-Zoom --- **/
function UnifiedScatter({ data, burntOrange }) {
  const VARS = [
    { key: "techScaled", label: "Technical Rank (0–100)", fixed: [0, 100] },
    { key: "gRank", label: "Sentiment Rank (1–100)", fixed: [0, 100] },
    { key: "comp2src", label: "Technical & Sentiment Rank", fixed: [0, 100] },
    { key: "comp3src", label: "Composite Rank (Technical, Sentiment, Fundamental)", fixed: [0, 100] },
    { key: "fundRank", label: "Fundamental Rank (0–100)", fixed: [0, 100] },
    { key: "fundChange", label: "Fundamental Change (Δ)" },
    { key: "rs3", label: "3-Month RS (raw)" },
    { key: "rs12", label: "12-Month RS (raw)" },
    { key: "rs3Rank", label: "3-Month RS Rank (0–100)", fixed: [0, 100] },
    { key: "rs12Rank", label: "12-Month RS Rank (0–100)", fixed: [0, 100] },
  ];

  const [xKey, setXKey] = useState("techScaled");
  const [yKey, setYKey] = useState("gRank");
  const [league, setLeague] = useState("All");

  // Measure container width
  const [wrapRef, widthPx] = useContainerWidth(600); // min width
  const svgW = widthPx;                                // full container width
  const svgH = Math.max(420, Math.round(svgW * 0.45)); // scale height with width

  const filtered = useMemo(() => data.filter((d) => (league === "All" ? true : d.league === league)), [data, league]);
  const rawPoints = useMemo(
    () => filtered.map((d) => ({ ...d, x: d[xKey], y: d[yKey] })).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y)),
    [filtered, xKey, yKey]
  );

  // Base extents from data/variable choice
  const xVar = VARS.find((v) => v.key === xKey) || VARS[0];
  const yVar = VARS.find((v) => v.key === yKey) || VARS[1];
  const baseXExtent = xVar.fixed ?? autoExtent(rawPoints.map((p) => p.x));
  const baseYExtent = yVar.fixed ?? autoExtent(rawPoints.map((p) => p.y));

  // View extents (zoomable)
  const [viewX, setViewX] = useState(baseXExtent);
  const [viewY, setViewY] = useState(baseYExtent);

  // Reset view when variable/league/data change
  useEffect(() => {
    setViewX(baseXExtent);
    setViewY(baseYExtent);
  }, [xKey, yKey, league, svgW, svgH, baseXExtent[0], baseXExtent[1], baseYExtent[0], baseYExtent[1]]); // eslint-disable-line

  const M = { top: 32, right: 20, bottom: 60, left: 72 };
  const W = svgW - M.left - M.right;
  const H = svgH - M.top - M.bottom;

  const xScale = (v) => {
    const [a, b] = viewX;
    if (a === b) return W / 2;
    return ((v - a) / (b - a)) * W;
  };
  const yScale = (v) => {
    const [a, b] = viewY;
    if (a === b) return H / 2;
    return H - ((v - a) / (b - a)) * H;
  };

  const xInv = (px) => {
    const [a, b] = viewX;
    return a + (px / W) * (b - a);
  };
  const yInv = (py) => {
    const [a, b] = viewY;
    // py measured from top (0 at top), invert y
    return a + ((H - py) / H) * (b - a);
  };

  const clampExtentToBase = (ex, base) => {
    let [a, b] = ex[0] <= ex[1] ? ex : [ex[1], ex[0]];
    const [ba, bb] = base;
    const span = Math.max(1e-6, Math.abs(b - a));
    // clamp into [ba, bb]
    a = Math.max(ba, Math.min(a, bb - 1e-6));
    b = Math.min(bb, Math.max(b, ba + 1e-6));
    // ensure min span
    if (b - a < 1e-6) {
      const mid = (a + b) / 2;
      a = mid - span / 2;
      b = mid + span / 2;
    }
    return [a, b];
  };

  // Visible points (within current view)
  const points = useMemo(
    () =>
      rawPoints.filter(
        (p) => p.x >= Math.min(...viewX) && p.x <= Math.max(...viewX) && p.y >= Math.min(...viewY) && p.y <= Math.max(...viewY)
      ),
    [rawPoints, viewX, viewY]
  );

  const xTicks = ticksFromExtent(viewX, 6);
  const yTicks = ticksFromExtent(viewY, 6);

  // OLS line (on currently visible points)
  const { m, b } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const n = xs.length;
    if (!n) return { m: NaN, b: NaN };
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      num += dx * (ys[i] - my);
      den += dx * dx;
    }
    const slope = den === 0 ? NaN : num / den;
    const intercept = Number.isFinite(slope) ? my - slope * mx : NaN;
    return { m: slope, b: intercept };
  }, [points]);

  // Label layout (for visible points)
  const FONT_SIZE = 11;
  const estWidth = (text) => Math.max(6, Math.round(text.length * FONT_SIZE * 0.55));
  const clampPix = (v, min, max) => Math.max(min, Math.min(max, v));
  const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const labels = useMemo(() => {
    const initial = points.map((d) => {
      const sx = xScale(d.x);
      const sy = yScale(d.y);
      const w = estWidth(d.player);
      const h = FONT_SIZE + 2;
      return { ...d, sx, sy, w, h };
    });

    initial.sort((a, b) => a.sy - b.sy);

    const placed = [];
    const results = [];
    const offsets = [
      [0, -6], [8, -6], [-8, -6],
      [0, 8], [10, 0], [-10, 0],
      [14, -12], [-14, -12], [14, 12], [-14, 12],
      [0, -14], [0, 14], [18, 0], [-18, 0],
    ];

    for (const d of initial) {
      let placedRect = null;
      let chosen = null;

      for (const [dx, dy] of offsets) {
        const cx = d.sx + dx;
        const cy = d.sy + dy;

        const xLeft = clampPix(cx - d.w / 2, 0, W - d.w);
        const yTop = clampPix(cy - d.h + 2, 0, H - d.h);
        const rect = { x: xLeft, y: yTop, w: d.w, h: d.h };

        if (rect.x < 0 || rect.x + rect.w > W || rect.y < 0 || rect.y + rect.h > H) continue;
        if (placed.some((r) => rectsOverlap(rect, r))) continue;

        placedRect = rect;
        chosen = { x: xLeft + d.w / 2, y: yTop + d.h - 2 };
        break;
      }

      if (!chosen) {
        const xLeft = clampPix(d.sx - d.w / 2, 0, W - d.w);
        const yTop = clampPix(d.sy - d.h + 2, 0, H - d.h);
        placedRect = { x: xLeft, y: yTop, w: d.w, h: d.h };
        chosen = { x: xLeft + d.w / 2, y: yTop + d.h - 2 };
      }

      placed.push(placedRect);
      results.push({ ...d, tx: chosen.x, ty: chosen.y });
    }

    return results;
  }, [points, xScale, yScale, W, H]);

  const xMid = W / 2;
  const yMid = H / 2;

  // ---------- Interactions: pinch, wheel, box-zoom ----------
  const overlayRef = useRef(null);
  const pointersRef = useRef(new Map()); // id -> {x,y}
  const pinchRef = useRef(null);         // {startDist, startViewX, startViewY, centerData}
  const [brush, setBrush] = useState(null); // {x0,y0,x1,y1} in pixels

  const getInnerXY = (e) => {
    const el = overlayRef.current;
    const rect = el.getBoundingClientRect();
    const x = clampPix(e.clientX - rect.left, 0, W);
    const y = clampPix(e.clientY - rect.top, 0, H);
    return { x, y };
  };

  const applyZoom = (cxPix, cyPix, scaleX, scaleY) => {
    const cx = xInv(cxPix);
    const cy = yInv(cyPix);
    const [xa, xb] = viewX;
    const [ya, yb] = viewY;

    const nxA = cx + (xa - cx) * scaleX;
    const nxB = cx + (xb - cx) * scaleX;
    const nyA = cy + (ya - cy) * scaleY;
    const nyB = cy + (yb - cy) * scaleY;

    const nextX = clampExtentToBase([nxA, nxB], baseXExtent);
    const nextY = clampExtentToBase([nyA, nyB], baseYExtent);

    setViewX(nextX);
    setViewY(nextY);
  };

  const onWheel = (e) => {
    e.preventDefault();
    if (!W || !H) return;
    // Zoom at cursor. Positive deltaY => zoom out
    const scale = Math.exp(e.deltaY * 0.001);
    const { x, y } = getInnerXY(e);
    applyZoom(x, y, scale, scale);
  };

  const onDblClick = () => {
    setViewX(baseXExtent);
    setViewY(baseYExtent);
    setBrush(null);
  };

  const onPointerDown = (e) => {
    const target = overlayRef.current;
    target.setPointerCapture(e.pointerId);
    const pos = getInnerXY(e);
    pointersRef.current.set(e.pointerId, pos);

    if (pointersRef.current.size === 2) {
      // Begin pinch
      const [p1, p2] = [...pointersRef.current.values()];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.hypot(dx, dy);
      const cxPix = (p1.x + p2.x) / 2;
      const cyPix = (p1.y + p2.y) / 2;
      pinchRef.current = {
        startDist: Math.max(1, dist),
        startViewX: viewX.slice(),
        startViewY: viewY.slice(),
        centerDataX: xInv(cxPix),
        centerDataY: yInv(cyPix),
      };
      setBrush(null); // cancel any brush
    } else if (pointersRef.current.size === 1 && e.pointerType !== "touch" && e.button === 0) {
      // Mouse box-zoom start
      setBrush({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    }
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const pos = getInnerXY(e);
    pointersRef.current.set(e.pointerId, pos);

    if (pointersRef.current.size === 2 && pinchRef.current) {
      // Pinch zoom
      const [p1, p2] = [...pointersRef.current.values()];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.hypot(dx, dy);
      const scale = pinchRef.current.startDist / Math.max(1, dist); // >1 => zoom in
      const cx = pinchRef.current.centerDataX;
      const cy = pinchRef.current.centerDataY;

      const svx = pinchRef.current.startViewX;
      const svy = pinchRef.current.startViewY;

      const nxA = cx + (svx[0] - cx) * scale;
      const nxB = cx + (svx[1] - cx) * scale;
      const nyA = cy + (svy[0] - cy) * scale;
      const nyB = cy + (svy[1] - cy) * scale;

      setViewX(clampExtentToBase([nxA, nxB], baseXExtent));
      setViewY(clampExtentToBase([nyA, nyB], baseYExtent));
    } else if (pointersRef.current.size === 1 && brush) {
      // Update box-zoom rectangle
      setBrush((b) => (b ? { ...b, x1: pos.x, y1: pos.y } : b));
    }
  };

  const onPointerUpCancel = (e) => {
    const hadPinch = pinchRef.current && pointersRef.current.size === 2;
    pointersRef.current.delete(e.pointerId);

    if (hadPinch && pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (brush && (e.type === "pointerup" || e.type === "pointercancel")) {
      const { x0, y0, x1, y1 } = brush;
      const minSel = 6; // pixels
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (w > minSel && h > minSel) {
        const xLo = Math.min(x0, x1);
        const xHi = Math.max(x0, x1);
        const yLo = Math.min(y0, y1);
        const yHi = Math.max(y0, y1);
        const newX = clampExtentToBase([xInv(xLo), xInv(xHi)], baseXExtent);
        const newY = clampExtentToBase([yInv(yHi), yInv(yLo)], baseYExtent); // y inverted
        setViewX(newX);
        setViewY(newY);
      }
      setBrush(null);
    }
  };

  // Styles for select controls
  const selectS = selectStyle(burntOrange);

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontWeight: 700, color: burntOrange }}>X:</label>
          <select value={xKey} onChange={(e) => setXKey(e.target.value)} style={selectS}>
            {VARS.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontWeight: 700, color: burntOrange }}>Y:</label>
          <select value={yKey} onChange={(e) => setYKey(e.target.value)} style={selectS}>
            {VARS.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: burntOrange }}>League:</span>
          {["All", "MLB", "NBA", "NFL"].map((lg) => (
            <label key={lg} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="leagueFilter" value={lg} checked={league === lg} onChange={() => setLeague(lg)} />
              {lg}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setViewX(baseXExtent);
            setViewY(baseYExtent);
            setBrush(null);
          }}
          style={{
            border: `1px solid ${burntOrange}`,
            background: "#fff",
            color: burntOrange,
            padding: "6px 12px",
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Reset Zoom
        </button>
      </div>

      {/* Chart */}
      <svg
        width={svgW}
        height={svgH}
        role="img"
        aria-label="Unified Scatterplot"
        onWheel={onWheel}
        onDoubleClick={onDblClick}
        style={{ touchAction: "none" }} // allow pinch/zoom gestures
      >
        <g transform={`translate(${M.left},${M.top})`}>
          {/* Quadrants */}
          <rect x={0} y={0} width={xMid} height={yMid} fill="blue" opacity="0.05" />
          <rect x={xMid} y={0} width={W - xMid} height={yMid} fill="green" opacity="0.07" />
          <rect x={0} y={yMid} width={xMid} height={H - yMid} fill="red" opacity="0.06" />
          <rect x={xMid} y={yMid} width={W - xMid} height={H - yMid} fill="yellow" opacity="0.10" />

          {/* Axes */}
          <line x1={0} y1={H} x2={W} y2={H} stroke="#ccc" />
          <line x1={0} y1={0} x2={0} y2={H} stroke="#ccc" />

          {/* Grid + Ticks (use view extents) */}
          {xTicks.map((t, i) => (
            <g key={`xt-${i}`} transform={`translate(${xScale(t)},0)`}>
              <line y1={0} y2={H} stroke="#eee" />
              <text y={H + 20} textAnchor="middle" fontSize="12" fill="#777">{formatTick(t)}</text>
            </g>
          ))}
          {yTicks.map((t, i) => (
            <g key={`yt-${i}`} transform={`translate(0,${yScale(t)})`}>
              <line x1={0} x2={W} stroke="#eee" />
              <text x={-12} y={4} textAnchor="end" fontSize="12" fill="#777">{formatTick(t)}</text>
            </g>
          ))}

          {/* OLS trendline */}
          {Number.isFinite(m) && Number.isFinite(b) && (
            <line
              x1={xScale(viewX[0])}
              y1={yScale(m * viewX[0] + b)}
              x2={xScale(viewX[1])}
              y2={yScale(m * viewX[1] + b)}
              stroke="#444"
              strokeDasharray="6,4"
            />
          )}

          {/* Labels */}
          {labels.map((d, idx) => (
            <g key={`${d.player}-${idx}`}>
              <circle cx={xScale(d.x)} cy={yScale(d.y)} r={3} fill={burntOrange} opacity="0.9" />
              <text x={d.tx} y={d.ty} fontSize={11} textAnchor="middle" fill="#333">
                {d.player}
              </text>
              <title>{`${d.player}${d.league ? ` (${d.league})` : ""}\nX: ${formatTick(d.x)}\nY: ${formatTick(d.y)}`}</title>
            </g>
          ))}

          {/* Axis labels */}
          <text x={W / 2} y={H + 40} textAnchor="middle" fontSize="14" fill="#333" fontWeight="700">
            {xVar.label}
          </text>
          <text transform="rotate(-90)" x={-H / 2} y={-56} textAnchor="middle" fontSize="14" fill="#333" fontWeight="700">
            {yVar.label}
          </text>

          {/* Interaction overlay (captures pointer/pinch/box-zoom) */}
          <rect
            ref={overlayRef}
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            style={{ touchAction: "none", cursor: brush ? "crosshair" : "default" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUpCancel}
            onPointerCancel={onPointerUpCancel}
          />
          {/* Brush rectangle */}
          {brush && (
            <rect
              x={Math.min(brush.x0, brush.x1)}
              y={Math.min(brush.y0, brush.y1)}
              width={Math.abs(brush.x1 - brush.x0)}
              height={Math.abs(brush.y1 - brush.y0)}
              fill="rgba(191,87,0,0.12)"
              stroke={burntOrange}
              strokeDasharray="4,3"
            />
          )}
        </g>
      </svg>
    </div>
  );
}

/** --- Box-Plot (FULL-WIDTH responsive) --- **/
function BoxPlotAllPlayers({ rankedRows, columns, burntOrange }) {
  const [boxLeague, setBoxLeague] = useState("All");
  const [wrapRef, widthPx] = useContainerWidth(680);       // min width for layout
  const LABEL_W = Math.min(300, Math.max(180, Math.round(widthPx * 0.22))); // adaptive label column
  const WIDTH = widthPx;                                   // full width
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

    return unsorted.sort((a, b) => (b.cur ?? -Infinity) - (a.cur ?? -Infinity));
  }, [playerCols, rankedRows]);

  const H = TOP_M + statsSorted.length * ROW_H + 28;
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
    <div style={{ marginTop: 18, padding: 12, borderTop: `1px solid ${burntOrange}`, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
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
            <span style={{ display: "inline-block", width: 18, height: 10, background: "#f2f2f2", border: "1px solid #999" }} />
            <span style={{ fontSize: 12 }}>IQR (Q1–Q3)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 18, height: 0, borderTop: "2px solid #333" }} />
            <span style={{ fontSize: 12 }}>Median</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width={18} height={12}><path d="M9 1 L16 6 L9 11 L2 6 Z" fill={burntOrange} stroke="#222" strokeWidth="1" /></svg>
            <span style={{ fontSize: 12 }}>Current value</span>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH, responsive; scroll only if tall */}
      <div ref={wrapRef} style={{ width: "100%" }}>
        <div style={{ maxHeight: 560, overflowY: "auto", border: "1px solid #eee", borderRadius: 8 }}>
          <svg width={WIDTH} height={H} role="img" aria-label="Box plots for all players">
            {/* Grid */}
            <g transform={`translate(${LABEL_W},${TOP_M})`}>
              {gridTicks.map((t) => (
                <g key={t} transform={`translate(${x(t)},0)`}>
                  <line y1={-TOP_M + 8} y2={H - TOP_M - 24} stroke="#eee" />
                  <text x={0} y={H - TOP_M - 8} fontSize="10" fill="#777" textAnchor="middle">{t}</text>
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
                      <text x={LABEL_W - 8} y={yMid + 3} textAnchor="end" fontSize="12" fill="#999">{s.col}</text>
                      <text x={LABEL_W + 8} y={yMid + 3} fontSize="11" fill="#bbb">No data</text>
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
                    <text x={LABEL_W - 8} y={yMid + 3} textAnchor="end" fontSize="12" fill="#333">{s.col}</text>

                    <g transform={`translate(${LABEL_W},0)`}>
                      <line x1={xMin} x2={xQ1} y1={yMid} y2={yMid} stroke="#aaa" />
                      <line x1={xQ3} x2={xMax} y1={yMid} y2={yMid} stroke="#aaa" />
                      <line x1={xMin} x2={xMin} y1={yMid - 4} y2={yMid + 4} stroke="#aaa" />
                      <line x1={xMax} x2={xMax} y1={yMid - 4} y2={yMid + 4} stroke="#aaa" />
                      <rect x={xQ1} y={yBoxTop} width={Math.max(1, xQ3 - xQ1)} height={yBoxH} fill="#f2f2f2" stroke="#999" />
                      <line x1={xMed} x2={xMed} y1={yBoxTop} y2={yBoxTop + yBoxH} stroke="#333" strokeWidth={2} />
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
      </div>
    </div>
  );
}

/** --- Shared helpers & hooks --- **/
function parseMonthHeader(h) {
  if (h == null) return null;
  if (typeof h === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = h * 24 * 60 * 60 * 1000;
    const d = new Date(epoch.getTime() + ms);
    if (isNaN(d)) return null;
    return toMonthStartISO(d);
  }
  if (h instanceof Date) {
    if (isNaN(h)) return null;
    return toMonthStartISO(h);
  }
  const s = String(h).trim();
  if (!s) return null;

  const m1 = s.match(/^([A-Za-z]{3,})[-\s]?(\d{2,4})$/);
  if (m1) {
    const month = monthIndexFromName(m1[1]);
    if (month != null) {
      let year = Number(m1[2]);
      if (year < 100) year += 2000;
      return toMonthStartISO(new Date(Date.UTC(year, month, 1)));
    }
  }

  const d2 = new Date(s);
  if (!isNaN(d2)) return toMonthStartISO(d2);
  return null;
}
function monthIndexFromName(name) {
  const m = name.toLowerCase().slice(0, 3);
  const arr = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const idx = arr.indexOf(m);
  return idx === -1 ? null : idx;
}
function toMonthStartISO(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dt = new Date(Date.UTC(y, m, 1));
  return dt.toISOString().slice(0, 10);
}

function toFiniteNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("<")) return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function toASCII(s) {
  if (typeof s !== "string") return s;
  let out = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out
    .replace(/ß/g, "ss").replace(/Đ/g, "D").replace(/đ/g, "d")
    .replace(/Ł/g, "L").replace(/ł/g, "l").replace(/Ø/g, "O").replace(/ø/g, "o")
    .replace(/Æ/g, "AE").replace(/æ/g, "ae").replace(/Œ/g, "OE").replace(/œ/g, "oe");
  return out;
}
function titleCaseFromKey(k) {
  const parts = String(k || "").split(/[\s._-]+/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function autoExtent(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.08 || 1;
  return [min - pad, max + pad];
}
function ticksFromExtent([min, max], n = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => roundNice(min + i * step));
}
function roundNice(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v);
  if (abs >= 100) return Math.round(v * 10) / 10;
  if (abs >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}
function formatTick(v) {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toString();
  if (abs >= 100) return (Math.round(v * 10) / 10).toString();
  if (abs >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}
function selectStyle(color) {
  return {
    border: `1px solid ${color}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 600,
    color,
    background: "#fff",
    outline: "none",
    cursor: "pointer",
  };
}
function sportToLeague(s) {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "";
  if (v.startsWith("foot")) return "NFL";
  if (v.startsWith("basket")) return "NBA";
  if (v.startsWith("base")) return "MLB";
  if (["mlb", "nba", "nfl"].includes(v)) return v.toUpperCase();
  return "";
}

/** Measure container width with ResizeObserver + window resize fallback */
function useContainerWidth(minWidth = 480) {
  const ref = useRef(null);
  const [w, setW] = useState(minWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setW(Math.max(minWidth, Math.floor(rect.width)));
    };

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      window.addEventListener("resize", update);
    }

    update();
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", update);
    };
  }, [minWidth]);

  return [ref, w];
}
