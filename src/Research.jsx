// src/Research.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

/**
 * Robust asset resolution:
 * - If files live in src/assets, use module URL.
 * - Else, fallback to public paths like /src-assets/...
 */
let logoUrl;
try {
  logoUrl = new URL("./assets/LogoSimple.jpg?url", import.meta.url).href; // src/assets
} catch {
  logoUrl = "/src-assets/LogoSimple.jpg"; // public/src-assets
}

let compUrl;
try {
  compUrl = new URL("./assets/Composite_Ranks_Data.xlsx?url", import.meta.url).href; // src/assets
} catch {
  compUrl = "/src-assets/Composite_Ranks_Data.xlsx"; // public/src-assets
}

let trendsUrl;
try {
  trendsUrl = new URL("./assets/Google_Trends_Ranks.xlsx?url", import.meta.url).href; // src/assets
} catch {
  trendsUrl = "/src-assets/Google_Trends_Ranks.xlsx"; // public/src-assets
}

export default function Research() {
  const burntOrange = "#BF5700";

  // -------- Scatterplot state --------
  const [rows, setRows] = useState([]);
  const [sport, setSport] = useState("All");
  const [xKey, setXKey] = useState(null);
  const [yKey, setYKey] = useState(null);
  const [nameKey, setNameKey] = useState(null);
  const [sportKey, setSportKey] = useState(null);
  const [numericCols, setNumericCols] = useState([]);

  // Zoom domains (null = none)
  const [xDomain, setXDomain] = useState(null);
  const [yDomain, setYDomain] = useState(null);

  // Box-zoom state
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState(null); // {x0,y0,x1,y1}
  const plotRef = useRef(null);

  // -------- Trends line chart state --------
  const [trendsRows, setTrendsRows] = useState([]);
  const [timeKey, setTimeKey] = useState(null);
  const [seriesKeys, setSeriesKeys] = useState([]); // numeric series columns
  const [selectedSeries, setSelectedSeries] = useState([]); // multiple selection

  // ===== Helpers =====
  const formatNum = (n) =>
    n == null || isNaN(n)
      ? ""
      : Math.abs(n) >= 1000
      ? n.toFixed(0)
      : Math.abs(n) >= 100
      ? n.toFixed(1)
      : Math.abs(n) >= 10
      ? n.toFixed(1)
      : n.toFixed(2);

  // Excel serial date (days since 1899-12-30) -> JS Date
  const excelSerialToDate = (d) => {
    if (typeof d !== "number" || !isFinite(d)) return null;
    const utcDays = Math.floor(d - 25569); // 25569 = days from 1899-12-30 to 1970-01-01
    const utcValue = utcDays * 86400; // seconds
    const dateInfo = new Date(utcValue * 1000);
    // Add the fractional day portion
    const fractionalDay = d - Math.floor(d);
    if (fractionalDay > 0) {
      const ms = Math.round(fractionalDay * 24 * 60 * 60 * 1000);
      dateInfo.setTime(dateInfo.getTime() + ms);
    }
    return dateInfo;
  };

  const tryParseDate = (v) => {
    if (v == null || v === "") return null;
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number") return excelSerialToDate(v);
    // Strings
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  // ===== Load Composite (scatter) XLSX =====
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(compUrl);
        if (!resp.ok) throw new Error(`Failed to fetch ${compUrl}`);
        const ab = await resp.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: null });

        const cols = json.length ? Object.keys(json[0]).map((c) => String(c).trim()) : [];

        // Case-insensitive column finder
        const findCol = (cands) => {
          const lc = cols.map((c) => c.toLowerCase());
          for (const cand of cands) {
            const i = lc.indexOf(String(cand).toLowerCase());
            if (i >= 0) return cols[i];
          }
          return null;
        };

        const guessedName = findCol(["Player", "Name", "PLAYER", "NAME"]);
        const guessedSport = findCol(["Sport", "SPORT", "League", "LEAGUE"]);

        // Detect numeric columns
        const isNum = (c) => json.some((r) => r[c] !== null && r[c] !== "" && !isNaN(Number(r[c])));
        let numCols = cols.filter(isNum);

        // Exclude sport column if it happens to be numeric-coded
        if (guessedSport) numCols = numCols.filter((c) => c !== guessedSport);

        // Exclude specific fields from X/Y dropdowns
        const excludedLC = new Set(["3-Mo Ret", "12-Mo Ret", "3mo RS", "12mo RS"].map((s) => s.toLowerCase()));
        numCols = numCols.filter((c) => !excludedLC.has(c.toLowerCase()));

        // Preferred defaults (only if still in numCols after exclusions)
        const prefer = (cands) => {
          const lcSet = new Set(numCols.map((c) => c.toLowerCase()));
          for (const k of cands) {
            if (lcSet.has(String(k).toLowerCase()))
              return numCols.find((c) => c.toLowerCase() === String(k).toLowerCase());
          }
          return null;
        };

        const preferredX =
          prefer(["gRank", "sentiment", "sentimentRank"]) ||
          prefer(["techScaled", "technical", "techRank"]) ||
          prefer(["comp3src", "composite", "comp2src"]);

        const preferredY =
          prefer(["comp3src", "composite", "comp2src"]) ||
          prefer(["gRank", "sentiment", "sentimentRank"]) ||
          prefer(["techScaled", "technical", "techRank"]);

        let x = preferredX;
        let y = preferredY;

        // Fallback to first two numeric columns if needed or if x === y
        if (!x || !y || x === y) {
          const [c1, c2] = numCols.slice(0, 2);
          if (!x) x = c1 || null;
          if (!y || y === x) y = c2 || null;
        }

        setRows(json);
        setNameKey(guessedName);
        setSportKey(guessedSport);
        setNumericCols(numCols);
        setXKey(x);
        setYKey(y);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ===== Load Google Trends XLSX =====
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(trendsUrl);
        if (!resp.ok) throw new Error(`Failed to fetch ${trendsUrl}`);
        const ab = await resp.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: null });

        if (!json.length) {
          setTrendsRows([]);
          setTimeKey(null);
          setSeriesKeys([]);
          return;
        }

        const cols = Object.keys(json[0]).map((c) => String(c).trim());

        // find time column
        const timeGuess = (() => {
          const lc = cols.map((c) => c.toLowerCase());
          const cands = ["date", "week", "time", "period"];
          for (const c of cands) {
            const i = lc.indexOf(c);
            if (i >= 0) return cols[i];
          }
          // else: heuristics: if first column parses as date for many rows
          const c0 = cols[0];
          const pass = json
            .slice(0, Math.min(12, json.length))
            .filter((r) => tryParseDate(r[c0]) !== null).length;
          if (pass >= Math.min(6, json.length)) return c0;
          // try any column that looks date-like
          for (const col of cols) {
            const ok = json
              .slice(0, Math.min(12, json.length))
              .filter((r) => tryParseDate(r[col]) !== null).length;
            if (ok >= Math.min(6, json.length)) return col;
          }
          return null;
        })();

        // series = numeric columns except time
        const isNumCol = (c) =>
          json.some((r) => r[c] !== null && r[c] !== "" && !isNaN(Number(r[c])));
        let sKeys = cols.filter((c) => c !== timeGuess && isNumCol(c));

        setTrendsRows(json);
        setTimeKey(timeGuess);
        setSeriesKeys(sKeys);

        // choose up to first 3 as default
        setSelectedSeries((prev) => {
          if (prev && prev.length) return prev;
          return sKeys.slice(0, Math.min(3, sKeys.length));
        });
      } catch (e) {
        console.error(e);
        setTrendsRows([]);
        setTimeKey(null);
        setSeriesKeys([]);
        setSelectedSeries([]);
      }
    })();
  }, []);

  // ===== Scatterplot computations =====
  const filtered = useMemo(() => {
    if (!rows.length) return [];
    if (!sportKey || sport === "All") return rows;
    return rows.filter((r) => {
      const v = (r[sportKey] ?? "").toString().toLowerCase();
      if (sport === "Baseball") return v.includes("baseball") || v.includes("mlb");
      if (sport === "Basketball") return v.includes("basketball") || v.includes("nba");
      if (sport === "Football") return v.includes("football") || v.includes("nfl");
      return true;
    });
  }, [rows, sport, sportKey]);

  const points = useMemo(() => {
    if (!xKey || !yKey) return [];
    return filtered
      .map((r) => {
        const x = Number(r[xKey]);
        const y = Number(r[yKey]);
        if (isNaN(x) || isNaN(y)) return null;
        return { x, y, name: nameKey ? r[nameKey] : "" };
      })
      .filter(Boolean);
  }, [filtered, xKey, yKey, nameKey]);

  // Chart geometry & scales (scatter)
  const WIDTH = 900,
    HEIGHT = 560;
  const M = { top: 28, right: 20, bottom: 56, left: 64 };
  const innerW = WIDTH - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;

  // Auto extents (un-padded; we'll pad only for autoscaling cases)
  const autoX = useMemo(() => {
    if (!points.length) return [0, 1];
    const min = Math.min(...points.map((p) => p.x));
    const max = Math.max(...points.map((p) => p.x));
    return [min, max];
  }, [points]);
  const autoY = useMemo(() => {
    if (!points.length) return [0, 1];
    const min = Math.min(...points.map((p) => p.y));
    const max = Math.max(...points.map((p) => p.y));
    return [min, max];
  }, [points]);

  function pad(min, max) {
    if (!(isFinite(min) && isFinite(max))) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    const span = max - min;
    return [min - span * 0.05, max + span * 0.05];
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Axis policy: 0–100 for all fields EXCEPT "Fundamental Change" (autoscale). Allow zoom within policy.
  const getExtent = (axisKey, domain, auto) => {
    const isFundChange = axisKey && axisKey.toLowerCase() === "fundamental change".toLowerCase();
    if (isFundChange) {
      return domain ? domain : pad(auto[0], auto[1]);
    }
    if (domain) {
      const lo = clamp(domain[0], 0, 100);
      const hi = clamp(domain[1], 0, 100);
      return hi > lo ? [lo, hi] : [0, 100];
    }
    return [0, 100];
  };

  const xExtent = getExtent(xKey, xDomain, autoX);
  const yExtent = getExtent(yKey, yDomain, autoY);

  const xScale = (v) => M.left + ((v - xExtent[0]) / (xExtent[1] - xExtent[0])) * innerW;
  const yScale = (v) => M.top + innerH - ((v - yExtent[0]) / (yExtent[1] - yExtent[0])) * innerH;

  const invX = (px) => ((px - M.left) / innerW) * (xExtent[1] - xExtent[0]) + xExtent[0];
  const invY = (py) => (1 - (py - M.top) / innerH) * (yExtent[1] - yExtent[0]) + yExtent[0];

  const ticks = (min, max, count = 5) => {
    const arr = [],
      step = (max - min) / count;
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  };

  // Quadrants (scatter)
  const midX = (xExtent[0] + xExtent[1]) / 2;
  const midY = (yExtent[0] + yExtent[1]) / 2;
  const midX_px = xScale(midX);
  const midY_px = yScale(midY);

  // Regression (scatter)
  const reg = useMemo(() => {
    if (points.length < 2) return null;
    const n = points.length;
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (const p of points) {
      sx += p.x;
      sy += p.y;
      sxx += p.x * p.x;
      sxy += p.x * p.y;
    }
    const xbar = sx / n,
      ybar = sy / n;
    const denom = sxx - n * xbar * xbar;
    const m = denom === 0 ? 0 : (sxy - n * xbar * ybar) / denom;
    const b = ybar - m * xbar;
    return { m, b };
  }, [points]);

  const regSegment = useMemo(() => {
    if (!reg) return null;
    const { m, b } = reg;
    const xmin = xExtent[0],
      xmax = xExtent[1],
      ymin = yExtent[0],
      ymax = yExtent[1];
    const candidates = [];
    const y1 = m * xmin + b;
    if (y1 >= ymin && y1 <= ymax) candidates.push({ x: xmin, y: y1 });
    const y2 = m * xmax + b;
    if (y2 >= ymin && y2 <= ymax) candidates.push({ x: xmax, y: y2 });
    if (m !== 0) {
      const x1 = (ymin - b) / m;
      if (x1 >= xmin && x1 <= xmax) candidates.push({ x: x1, y: ymin });
      const x2 = (ymax - b) / m;
      if (x2 >= xmin && x2 <= xmax) candidates.push({ x: x2, y: ymax });
    }
    if (candidates.length < 2) return null;
    candidates.sort((a, bp) => a.x - bp.x);
    const p0 = candidates[0],
      p1 = candidates[candidates.length - 1];
    return { x0: xScale(p0.x), y0: yScale(p0.y), x1: xScale(p1.x), y1: yScale(p1.y) };
  }, [reg, xExtent, yExtent]);

  // Box Zoom handlers (scatter)
  const clampToPlot = (x, y) => {
    const cx = Math.max(M.left, Math.min(M.left + innerW, x));
    const cy = Math.max(M.top, Math.min(M.top + innerH, y));
    return [cx, cy];
  };
  const onPlotMouseDown = (e) => {
    if (!plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const [cx, cy] = clampToPlot(e.clientX - rect.left, e.clientY - rect.top);
    setDragging(true);
    setBox({ x0: cx, y0: cy, x1: cx, y1: cy });
  };
  const onPlotMouseMove = (e) => {
    if (!dragging || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const [cx, cy] = clampToPlot(e.clientX - rect.left, e.clientY - rect.top);
    setBox((b) => (b ? { ...b, x1: cx, y1: cy } : b));
  };
  const onPlotMouseUp = () => {
    if (!dragging || !box) {
      setDragging(false);
      setBox(null);
      return;
    }
    const { x0, y0, x1, y1 } = box;
    const w = Math.abs(x1 - x0),
      h = Math.abs(y1 - y0);
    if (w >= 6 && h >= 6) {
      const left = Math.min(x0, x1),
        right = Math.max(x0, x1);
      const top = Math.min(y0, y1),
        bottom = Math.max(y0, y1);
      const nx0 = invX(left),
        nx1 = invX(right);
      const ny0 = invY(bottom),
        ny1 = invY(top);
      if (isFinite(nx0) && isFinite(nx1) && nx1 > nx0) setXDomain([nx0, nx1]);
      if (isFinite(ny0) && isFinite(ny1) && ny1 > ny0) setYDomain([ny0, ny1]);
    }
    setDragging(false);
    setBox(null);
  };
  const resetZoom = () => {
    setXDomain(null);
    setYDomain(null);
  };

  // ===== Trends chart computed data =====
  const trendsPointsBySeries = useMemo(() => {
    if (!trendsRows.length || !timeKey || !seriesKeys.length) return {};
    // Map each selected series to array of {t: Date, y: number}
    const result = {};
    for (const s of seriesKeys) {
      result[s] = trendsRows
        .map((r) => {
          const t = tryParseDate(r[timeKey]);
          const y = Number(r[s]);
          return t && !isNaN(y) ? { t, y: Math.max(0, Math.min(100, y)) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.t - b.t);
    }
    return result;
  }, [trendsRows, timeKey, seriesKeys]);

  // X time domain across all selected series
  const trendsAllPoints = useMemo(() => {
    const arr = [];
    for (const s of selectedSeries) {
      if (trendsPointsBySeries[s]) arr.push(...trendsPointsBySeries[s]);
    }
    return arr.sort((a, b) => a.t - b.t);
  }, [trendsPointsBySeries, selectedSeries]);

  const trendsXDomain = useMemo(() => {
    if (!trendsAllPoints.length) return [new Date(), new Date()];
    return [trendsAllPoints[0].t, trendsAllPoints[trendsAllPoints.length - 1].t];
  }, [trendsAllPoints]);

  // Trends chart geometry
  const TW = 900,
    TH = 320;
  const TM = { top: 24, right: 20, bottom: 48, left: 64 };
  const TinnerW = TW - TM.left - TM.right;
  const TinnerH = TH - TM.top - TM.bottom;

  const tScale = (d) => {
    const [t0, t1] = trendsXDomain;
    const span = t1 - t0 || 1;
    return TM.left + ((d - t0) / span) * TinnerW;
  };
  const tyScale = (v) => {
    // 0..100 fixed
    return TM.top + TinnerH - ((v - 0) / (100 - 0)) * TinnerH;
  };

  const buildPath = (pts) => {
    if (!pts || !pts.length) return "";
    let d = `M ${tScale(pts[0].t)} ${tyScale(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${tScale(pts[i].t)} ${tyScale(pts[i].y)}`;
    }
    return d;
  };

  const timeTicks = useMemo(() => {
    const [t0, t1] = trendsXDomain;
    const count = 6;
    const out = [];
    const span = t1 - t0 || 1;
    for (let i = 0; i <= count; i++) {
      out.push(new Date(t0.getTime() + (i / count) * span));
    }
    return out;
  }, [trendsXDomain]);

  const fmtMonth = (d) => {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${m.toString().padStart(2, "0")}`;
  };

  // Simple categorical color palette
  const palette = [
    "#0d6efd",
    "#198754",
    "#dc3545",
    "#fd7e14",
    "#6f42c1",
    "#20c997",
    "#0dcaf0",
    "#6610f2",
    "#6c757d",
    "#ffc107",
  ];
  const colorFor = (key) => {
    const i = seriesKeys.indexOf(key);
    return palette[i % palette.length] || "#333";
  };

  // ===== UI =====
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20 }}>
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <img src={logoUrl} alt="Logo" style={{ width: 120, marginBottom: 12 }} />
      </div>

      {/* Title */}
      <h1 style={{ color: burntOrange, fontSize: "2.5rem", margin: "0 0 8px", textAlign: "center" }}>
        Sports Card Research
      </h1>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          margin: "14px 0 18px",
        }}
      >
        {/* Sport toggle */}
        <div style={{ display: "flex", gap: 8 }}>
          {["All", "Baseball", "Basketball", "Football"].map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `2px solid ${burntOrange}`,
                background: sport === s ? burntOrange : "#fff",
                color: sport === s ? "#fff" : burntOrange,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* X / Y dropdowns */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>X:</label>
          <select
            value={xKey || ""}
            onChange={(e) => {
              setXKey(e.target.value || null);
              setXDomain(null);
            }}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc", minWidth: 180 }}
          >
            <option value="">-- Choose X --</option>
            {numericCols.map((c) => (
              <option key={`x-${c}`} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13 }}>Y:</label>
          <select
            value={yKey || ""}
            onChange={(e) => {
              setYKey(e.target.value || null);
              setYDomain(null);
            }}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc", minWidth: 180 }}
          >
            <option value="">-- Choose Y --</option>
            {numericCols.map((c) => (
              <option key={`y-${c}`} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Reset zoom */}
        <button
          onClick={resetZoom}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `2px solid ${burntOrange}`,
            background: "#fff",
            color: burntOrange,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="Reset zoom"
        >
          Reset Zoom
        </button>
      </div>

      {/* ==== SCATTERPLOT ==== */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg
          ref={plotRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff" }}
          onMouseDown={onPlotMouseDown}
          onMouseMove={onPlotMouseMove}
          onMouseUp={onPlotMouseUp}
          onDoubleClick={resetZoom}
        >
          {/* Quadrant background rectangles */}
          {/* UL (blue) */}
          <rect
            x={M.left}
            y={M.top}
            width={xScale((xExtent[0] + xExtent[1]) / 2) - M.left}
            height={yScale((yExtent[0] + yExtent[1]) / 2) - M.top}
            fill="rgba(0,123,255,0.12)"
          />
          {/* UR (green) */}
          <rect
            x={midX_px}
            y={M.top}
            width={M.left + innerW - midX_px}
            height={midY_px - M.top}
            fill="rgba(40,167,69,0.12)"
          />
          {/* LL (red) */}
          <rect
            x={M.left}
            y={midY_px}
            width={midX_px - M.left}
            height={M.top + innerH - midY_px}
            fill="rgba(220,53,69,0.12)"
          />
          {/* LR (yellow) */}
          <rect
            x={midX_px}
            y={midY_px}
            width={M.left + innerW - midX_px}
            height={M.top + innerH - midY_px}
            fill="rgba(255,193,7,0.18)"
          />

          {/* Axes */}
          <line x1={M.left} y1={M.top + innerH} x2={M.left + innerW} y2={M.top + innerH} stroke="#999" />
          <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + innerH} stroke="#999" />

          {/* Midlines */}
          <line x1={midX_px} y1={M.top} x2={midX_px} y2={M.top + innerH} stroke="#aaa" strokeDasharray="4,4" />
          <line x1={M.left} y1={midY_px} x2={M.left + innerW} y2={midY_px} stroke="#aaa" strokeDasharray="4,4" />

          {/* X ticks */}
          {ticks(xExtent[0], xExtent[1], 5).map((t, i) => {
            const x = xScale(t);
            return (
              <g key={`xt-${i}`}>
                <line x1={x} y1={M.top + innerH} x2={x} y2={M.top + innerH + 6} stroke="#999" />
                <text x={x} y={M.top + innerH + 20} fontSize={11} textAnchor="middle" fill="#333">
                  {formatNum(t)}
                </text>
              </g>
            );
          })}

          {/* Y ticks */}
          {ticks(yExtent[0], yExtent[1], 5).map((t, i) => {
            const y = yScale(t);
            return (
              <g key={`yt-${i}`}>
                <line x1={M.left - 6} y1={y} x2={M.left} y2={y} stroke="#999" />
                <text x={M.left - 10} y={y + 3} fontSize={11} textAnchor="end" fill="#333">
                  {formatNum(t)}
                </text>
              </g>
            );
          })}

          {/* Axis Labels */}
          <text x={M.left + innerW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={12} fill="#333">
            {xKey || "X"}
          </text>
          <text
            x={16}
            y={M.top + innerH / 2}
            transform={`rotate(-90, 16, ${M.top + innerH / 2})`}
            textAnchor="middle"
            fontSize={12}
            fill="#333"
          >
            {yKey || "Y"}
          </text>

          {/* Regression line */}
          {regSegment && (
            <line x1={regSegment.x0} y1={regSegment.y0} x2={regSegment.x1} y2={regSegment.y1} stroke="#333" strokeWidth="2" opacity="0.7" />
          )}

          {/* Names as markers (burnt orange) */}
          {points.map((d, i) => (
            <text
              key={`name-${i}`}
              x={xScale(d.x)}
              y={yScale(d.y)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight={700}
              fill={burntOrange}
              style={{ pointerEvents: "none" }}
            >
              {d.name ?? ""}
            </text>
          ))}

          {/* Drag box */}
          {dragging && box && (
            <rect
              x={Math.min(box.x0, box.x1)}
              y={Math.min(box.y0, box.y1)}
              width={Math.abs(box.x1 - box.x0)}
              height={Math.abs(box.y1 - box.y0)}
              fill="rgba(191,87,0,0.12)"
              stroke={burntOrange}
              strokeDasharray="4,4"
            />
          )}
        </svg>
      </div>

      {/* ==== TRENDS LINE CHART CONTROLS ==== */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, color: "#333" }}>Sentiment Rankings:</div>
        <select
          multiple
          size={Math.min(8, Math.max(3, seriesKeys.length || 3))}
          value={selectedSeries}
          onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
            setSelectedSeries(opts);
          }}
          style={{ minWidth: 260, padding: 6, borderRadius: 8, border: "1px solid #ccc" }}
          title="Hold Ctrl/Cmd to select multiple"
        >
          {seriesKeys
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
        </select>

        {/* legend (kept as-is; sorts not required) */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", maxWidth: 480 }}>
          {selectedSeries.map((k) => (
            <div key={`lg-${k}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 14, height: 3, background: colorFor(k) }} />
              <span style={{ fontSize: 12 }}>{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ==== TRENDS LINE CHART ==== */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <svg width={TW} height={TH} style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          {/* axes */}
          <line x1={TM.left} y1={TM.top + TinnerH} x2={TM.left + TinnerW} y2={TM.top + TinnerH} stroke="#999" />
          <line x1={TM.left} y1={TM.top} x2={TM.left} y2={TM.top + TinnerH} stroke="#999" />

          {/* Y ticks 0..100 */}
          {[0, 20, 40, 60, 80, 100].map((val, i) => {
            const y = tyScale(val);
            return (
              <g key={`ty-${i}`}>
                <line x1={TM.left - 6} y1={y} x2={TM.left} y2={y} stroke="#999" />
                <text x={TM.left - 10} y={y + 3} fontSize={11} textAnchor="end" fill="#333">
                  {val}
                </text>
              </g>
            );
          })}

          {/* X time ticks */}
          {timeTicks.map((d, i) => {
            const x = tScale(d);
            return (
              <g key={`tt-${i}`}>
                <line x1={x} y1={TM.top + TinnerH} x2={x} y2={TM.top + TinnerH + 6} stroke="#999" />
                <text x={x} y={TM.top + TinnerH + 20} fontSize={11} textAnchor="middle" fill="#333">
                  {fmtMonth(d)}
                </text>
              </g>
            );
          })}

          {/* labels */}
          <text x={TM.left + TinnerW / 2} y={TH - 8} textAnchor="middle" fontSize={12} fill="#333">
            {timeKey || "Time"}
          </text>
          <text
            x={16}
            y={TM.top + TinnerH / 2}
            transform={`rotate(-90, 16, ${TM.top + TinnerH / 2})`}
            textAnchor="middle"
            fontSize={12}
            fill="#333"
          >
            Sentiment Rank (12-Mo Average) (0–100)
          </text>

          {/* series lines */}
          {selectedSeries.map((k) => {
            const pts = trendsPointsBySeries[k] || [];
            const d = buildPath(pts);
            return <path key={`path-${k}`} d={d} fill="none" stroke={colorFor(k)} strokeWidth="2" opacity="0.9" />;
          })}
        </svg>
      </div>

      {/* Disclosure text (kept beneath both charts) */}
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <span style={{ color: burntOrange, fontSize: 12 }}>
          Source:  Sports-Reference.com, Google, and Card Ladder with data transformed by Longhorn Cards and Collectibles
        </span>
      </div>

      {/* Empty states */}
      {(!points.length || !trendsRows.length) && (
        <div style={{ textAlign: "center", marginTop: 14, color: "#666" }}>
          {!points.length && (rows.length ? "No numeric columns found to plot or empty selection." : "Loading composite data…")}
          {!trendsRows.length && <div>Loading Google Trends data…</div>}
        </div>
      )}
    </div>
  );
}
