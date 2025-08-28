// src/Research.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

/** Measure a container’s width (works on resize) */
function useContainerWidth(minWidth = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(minWidth);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (ref.current) setW(ref.current.clientWidth);
    });
    if (ref.current) {
      setW(ref.current.clientWidth);
      ro.observe(ref.current);
    }
    return () => ro.disconnect();
  }, []);
  return [ref, Math.max(minWidth, w)];
}

/** Clamp helper */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Number formatter */
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

/** Excel serial date -> JS Date */
const excelSerialToDate = (d) => {
  if (typeof d !== "number" || !isFinite(d)) return null;
  const utcDays = Math.floor(d - 25569); // 25569 = days from 1899-12-30 to 1970-01-01
  const theUtcSeconds = utcDays * 86400; // seconds
  const dateInfo = new Date(theUtcSeconds * 1000);
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
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export default function Research() {
  const burntOrange = "#BF5700";

  // -------- Scatterplot state --------
  const [rows, setRows] = useState([]);
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState("All"); // NEW: Status filter
  const [xKey, setXKey] = useState(null);
  const [yKey, setYKey] = useState(null);
  const [nameKey, setNameKey] = useState(null);
  const [sportKey, setSportKey] = useState(null);
  const [statusKey, setStatusKey] = useState(null); // NEW: Status column key
  const [numericCols, setNumericCols] = useState([]);

  // Columns for modal summary (found robustly)
  const [compCol, setCompCol] = useState(null);
  const [fundCol, setFundCol] = useState(null);
  const [techCol, setTechCol] = useState(null);
  const [sentCol, setSentCol] = useState(null);
  const [fundChgCol, setFundChgCol] = useState(null);
  const [ratingCol, setRatingCol] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState("");

  // Zoom domains (null = none)
  const [xDomain, setXDomain] = useState(null);
  const [yDomain, setYDomain] = useState(null);

  // Box-zoom state (pointer-based = works on mouse + touch)
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState(null); // {x0,y0,x1,y1}
  const plotRef = useRef(null);

  // Tooltip for scatter (works on tap)
  const [tip, setTip] = useState(null); // {x,y,content}

  // -------- Trends line chart state --------
  const [trendsRows, setTrendsRows] = useState([]);
  const [timeKey, setTimeKey] = useState(null);
  const [seriesKeys, setSeriesKeys] = useState([]); // numeric series columns
  const [selectedSeries, setSelectedSeries] = useState([]); // multiple selection

  // ---------- DATA LOAD: Composite (scatter + modal) ----------
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
        const guessedStatus = findCol([
          "Status",
          "PLAYER STATUS",
          "Career Status",
          "Active/Retired",
          "PlayerStatus",
          "STATUS",
        ]); // NEW: detect status column

        // Robust metric columns (modal & general use)
        const compositeCol = findCol([
          "Composite Rank",
          "Composite",
          "Comp3Src",
          "CompositeRank",
          "Comp2Src",
          "Composite_Rank",
          "compRank",
        ]);
        const fundamentalCol = findCol([
          "Fundamental Rank",
          "Fundamentals Rank",
          "Fundamental",
          "FundRank",
          "FUNDAMENTAL RANK",
        ]);
        const technicalCol = findCol([
          "Technical Rank",
          "Technical",
          "Tech Rank",
          "TechScaled",
          "TECHNICAL RANK",
        ]);
        const sentimentCol = findCol([
          "Sentiment Rank",
          "Sentiment",
          "gRank",
          "SentimentRank",
          "SENTIMENT RANK",
        ]);
        const fundamentalChangeCol = findCol([
          "Fundamental Change",
          "Fundamental Δ",
          "Fund Change",
          "FundChange",
          "FUNDAMENTAL CHANGE",
        ]);

        // IMPORTANT: do NOT confuse "Status" (Active/Retired) with "Rating"
        const ratingDetectedCol = findCol([
          "Rating",
          "RATING",
          "Trade Rating",
          "Recommendation",
          "Reco",
          "Buy/Hold",
        ]);

        // Detect numeric columns (for scatter X/Y dropdowns)
        const isNum = (c) => json.some((r) => r[c] !== null && r[c] !== "" && !isNaN(Number(r[c])));
        let numCols = cols.filter(isNum);

        // Exclude sport/status columns if they look numeric-coded
        if (guessedSport) numCols = numCols.filter((c) => c !== guessedSport);
        if (guessedStatus) numCols = numCols.filter((c) => c !== guessedStatus);

        // Exclude specific fields from X/Y dropdowns
        const excludedLC = new Set(
          ["3-Mo Ret", "12-Mo Ret", "3mo RS", "12mo RS", "Fundamental Change"].map((s) =>
            s.toLowerCase()
          )
        );
        numCols = numCols.filter((c) => !excludedLC.has(c.toLowerCase())); // keep Fundamental Change out of scatter

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
          prefer(["gRank", "sentiment", "sentimentrank"]) ||
          prefer(["techscaled", "technical", "tech rank"]) ||
          prefer(["comp3src", "composite", "comp2src", "composite rank"]);

        const preferredY =
          prefer(["composite rank", "comp3src", "composite", "comp2src"]) ||
          prefer(["gRank", "sentiment", "sentimentrank"]) ||
          prefer(["techscaled", "technical", "tech rank"]);

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
        setStatusKey(guessedStatus); // NEW
        setNumericCols(numCols);
        setXKey(x);
        setYKey(y);

        // Set modal metric columns
        setCompCol(compositeCol);
        setFundCol(fundamentalCol);
        setTechCol(technicalCol);
        setSentCol(sentimentCol);
        setFundChgCol(fundamentalChangeCol);
        setRatingCol(ratingDetectedCol);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ---------- DATA LOAD: Google Trends ----------
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

  // ===== Players for modal =====
  const players = useMemo(() => {
    if (!rows.length || !nameKey) return [];
    const set = new Set();
    for (const r of rows) {
      const v = r[nameKey];
      if (v != null && String(v).trim() !== "") set.add(String(v).trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, nameKey]);

  // Summary for selected player (averages if multiple rows found)
  const playerSummary = useMemo(() => {
    if (!selectedPlayer || !nameKey) return null;
    const list = rows.filter(
      (r) => String(r[nameKey] ?? "").trim().toLowerCase() === selectedPlayer.trim().toLowerCase()
    );
    if (!list.length) return null;

    const avgOf = (col) => {
      if (!col) return null;
      const vals = list.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const modeOfRating = () => {
      if (!ratingCol) return null;
      const vals = list
        .map((r) => (r[ratingCol] == null ? "" : String(r[ratingCol]).trim()))
        .filter((v) => v !== "");
      if (!vals.length) return null;

      // normalize to Buy/Hold (case-insensitive, allow abbreviations)
      const norm = (s) => {
        const t = s.toLowerCase();
        if (t === "buy" || t === "b") return "Buy";
        if (t === "hold" || t === "h") return "Hold";
        return s; // fall back to whatever is in file
        };
      const normalized = vals.map(norm);

      // frequency count
      const freq = {};
      for (const v of normalized) freq[v] = (freq[v] || 0) + 1;
      let best = normalized[0],
        bestCount = 0;
      for (const k of Object.keys(freq)) {
        if (freq[k] > bestCount) {
          best = k;
          bestCount = freq[k];
        }
      }
      // As a tie-break, prefer "Buy" over "Hold" if equal frequency
      if (freq["Buy"] === freq["Hold"] && freq["Buy"] != null) return "Buy";
      return best;
    };

    return {
      count: list.length,
      composite: avgOf(compCol),
      fundamental: avgOf(fundCol),
      technical: avgOf(techCol),
      sentiment: avgOf(sentCol),
      fundChange: avgOf(fundChgCol),
      rating: modeOfRating(),
    };
  }, [rows, nameKey, selectedPlayer, compCol, fundCol, techCol, sentCol, fundChgCol, ratingCol]);

  // ===== Scatterplot computations =====
  const filtered = useMemo(() => {
    if (!rows.length) return [];

    // 1) Sport filter
    let out = rows;
    if (sportKey && sport !== "All") {
      out = out.filter((r) => {
        const v = (r[sportKey] ?? "").toString().toLowerCase();
        if (sport === "Baseball") return v.includes("baseball") || v.includes("mlb");
        if (sport === "Basketball") return v.includes("basketball") || v.includes("nba");
        if (sport === "Football") return v.includes("football") || v.includes("nfl");
        return true;
      });
    }

    // 2) Status filter (NEW)
    if (statusKey && status !== "All") {
      const pick = status.toLowerCase(); // "active" or "retired"
      out = out.filter((r) => {
        const raw = (r[statusKey] ?? "").toString().toLowerCase();

        // common positive signals
        const isActive =
          raw.includes("active") ||
          raw.includes("current") ||
          raw.includes("playing") ||
          raw.includes("rookie") ||
          raw.includes("prospect");

        const isRetired =
          raw.includes("retired") ||
          raw.includes("former") ||
          raw.includes("hall") || // "Hall of Fame", "HOF"
          raw.includes("hof") ||
          raw.includes("inactive");

        if (pick === "active") {
          // If the column is noisy/mixed, prefer explicit "active" signals
          if (isActive) return true;
          if (isRetired) return false;
          // fallback heuristic: if no signals, keep the row (avoid over-filtering)
          return false;
        }
        if (pick === "retired") {
          if (isRetired) return true;
          if (isActive) return false;
          return false;
        }
        return true;
      });
    }

    return out;
  }, [rows, sport, sportKey, status, statusKey]);

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

  // ======= Responsive layout =======
  const [scatterRef, scatterW] = useContainerWidth(320);
  const S_WIDTH = scatterW;
  const S_HEIGHT = Math.round(clamp(scatterW * 0.62, 260, 560));
  const SM = { top: 28, right: 16, bottom: 48, left: 56 };
  const S_innerW = S_WIDTH - SM.left - SM.right;
  const S_innerH = S_HEIGHT - SM.top - SM.bottom;

  // Axis policy: fixed 0–100
  const getExtent = (domain) => {
    if (domain) {
      const lo = clamp(domain[0], 0, 100);
      const hi = clamp(domain[1], 0, 100);
      return hi > lo ? [lo, hi] : [0, 100];
    }
    return [0, 100];
  };

  const xExtent = getExtent(xDomain);
  const yExtent = getExtent(yDomain);

  const xScale = (v) => SM.left + ((v - xExtent[0]) / (xExtent[1] - xExtent[0])) * S_innerW;
  const yScale = (v) => SM.top + S_innerH - ((v - yExtent[0]) / (yExtent[1] - yExtent[0])) * S_innerH;

  const invX = (px) => ((px - SM.left) / S_innerW) * (xExtent[1] - xExtent[0]) + xExtent[0];
  const invY = (py) => (1 - (py - SM.top) / S_innerH) * (yExtent[1] - yExtent[0]) + yExtent[0];

  const ticks = (min, max, count = 5) => {
    const arr = [];
    const step = (max - min) / count;
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  };

  // Quadrants
  const midX = (xExtent[0] + xExtent[1]) / 2;
  const midY = (yExtent[0] + yExtent[1]) / 2;
  const midX_px = xScale(midX);
  const midY_px = yScale(midY);

  // Regression
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

  // Pointer handlers for box zoom
  const clampToPlot = (x, y) => {
    const cx = Math.max(SM.left, Math.min(SM.left + S_innerW, x));
    const cy = Math.max(SM.top, Math.min(SM.top + S_innerH, y));
    return [cx, cy];
  };
  const onPlotPointerDown = (e) => {
    if (!plotRef.current) return;
    plotRef.current.setPointerCapture?.(e.pointerId);
    const rect = plotRef.current.getBoundingClientRect();
    const [cx, cy] = clampToPlot(e.clientX - rect.left, e.clientY - rect.top);
    setDragging(true);
    setBox({ x0: cx, y0: cy, x1: cx, y1: cy });
  };
  const onPlotPointerMove = (e) => {
    if (!dragging || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const [cx, cy] = clampToPlot(e.clientX - rect.left, e.clientY - rect.top);
    setBox((b) => (b ? { ...b, x1: cx, y1: cy } : b));
  };
  const onPlotPointerUp = () => {
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
        bottom = Math.max(y1, y0);
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

  const [trendsRef, trendsW] = useContainerWidth(320);
  const T_WIDTH = trendsW;
  const T_HEIGHT = Math.round(clamp(trendsW * 0.62, 260, 560));
  const TM = { top: 24, right: 16, bottom: 48, left: 56 };
  const T_innerW = T_WIDTH - TM.left - TM.right;
  const T_innerH = T_HEIGHT - TM.top - TM.bottom;

  const tScale = (d) => {
    const [t0, t1] = trendsXDomain;
    const span = t1 - t0 || 1;
    return TM.left + ((d - t0) / span) * T_innerW;
  };
  const tyScale = (v) => TM.top + T_innerH - ((v - 0) / (100 - 0)) * T_innerH;

  const buildPath = (pts) => {
    if (!pts || !pts.length) return "";
    let d = `M ${tScale(pts[0].t)} ${tyScale(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${tScale(pts[i].t)} ${tyScale(pts[i].y)}`;
    return d;
  };

  const timeTicks = useMemo(() => {
    const [t0, t1] = trendsXDomain;
    const count = 5;
    const out = [];
    const span = t1 - t0 || 1;
    for (let i = 0; i <= count; i++) out.push(new Date(t0.getTime() + (i / count) * span));
    return out;
  }, [trendsXDomain]);

  const fmtMonth = (d) => {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${m.toString().padStart(2, "0")}`;
  };

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

  const smallScreen = S_WIDTH < 520;

  // ===== UI =====
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Top Row: Back + Search Player Ranks */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 8,
            border: `2px solid ${burntOrange}`,
            background: "#fff",
            color: burntOrange,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ⬅ Back to Home
        </Link>

        <button
          onClick={() => setShowModal(true)}
          style={{
            background: "transparent",
            border: "none",
            color: burntOrange,
            fontWeight: 800,
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "clamp(0.95rem, 2.8vw, 1.1rem)",
          }}
          title="Open player rank search"
        >
          🔎 Search Player Ranks
        </button>
      </div>

      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <img src={logoUrl} alt="Logo" style={{ width: 96, maxWidth: "28vw", marginBottom: 10 }} />
      </div>

      {/* Title */}
      <h1
        style={{
          color: burntOrange,
          textAlign: "center",
          margin: "0 0 10px",
          fontWeight: 800,
          fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
          lineHeight: 1.1,
        }}
      >
        Sports Card Research
      </h1>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          margin: "12px 0 14px",
        }}
      >
        {/* Sport toggle */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
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
                fontSize: "0.9rem",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Status toggle (NEW) */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            opacity: statusKey ? 1 : 0.5,
          }}
          title={statusKey ? "Filter by Active/Retired" : "Status column not found in the data"}
        >
          {["All", "Active", "Retired"].map((s) => (
            <button
              key={`status-${s}`}
              onClick={() => statusKey && setStatus(s)}
              disabled={!statusKey}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `2px solid ${burntOrange}`,
                background: status === s ? burntOrange : "#fff",
                color: status === s ? "#fff" : burntOrange,
                fontWeight: 700,
                cursor: statusKey ? "pointer" : "not-allowed",
                fontSize: "0.9rem",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* X / Y dropdowns */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>X:</label>
          <select
            value={xKey || ""}
            onChange={(e) => {
              setXKey(e.target.value || null);
              setXDomain(null);
            }}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #ccc",
              minWidth: 160,
              maxWidth: 220,
            }}
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
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #ccc",
              minWidth: 160,
              maxWidth: 220,
            }}
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
            fontSize: "0.9rem",
          }}
          title="Reset zoom"
        >
          Reset Zoom
        </button>
      </div>

      {/* ==== SCATTERPLOT ==== */}
      <div
        ref={scatterRef}
        style={{ width: "100%", maxWidth: "100%", display: "flex", justifyContent: "center" }}
      >
        <svg
          ref={plotRef}
          width={S_WIDTH}
          height={S_HEIGHT}
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fff",
            touchAction: "none",
          }}
          onPointerDown={onPlotPointerDown}
          onPointerMove={onPlotPointerMove}
          onPointerUp={onPlotPointerUp}
          onDoubleClick={resetZoom}
        >
          {/* Quadrants */}
          <rect
            x={SM.left}
            y={SM.top}
            width={xScale((xExtent[0] + xExtent[1]) / 2) - SM.left}
            height={yScale((yExtent[0] + yExtent[1]) / 2) - SM.top}
            fill="rgba(0,123,255,0.12)"
          />
          <rect
            x={midX_px}
            y={SM.top}
            width={SM.left + S_innerW - midX_px}
            height={midY_px - SM.top}
            fill="rgba(40,167,69,0.12)"
          />
          <rect
            x={SM.left}
            y={midY_px}
            width={midX_px - SM.left}
            height={SM.top + S_innerH - midY_px}
            fill="rgba(220,53,69,0.12)"
          />
          <rect
            x={midX_px}
            y={midY_px}
            width={SM.left + S_innerW - midX_px}
            height={SM.top + S_innerH - midY_px}
            fill="rgba(255,193,7,0.18)"
          />

          {/* Axes */}
          <line x1={SM.left} y1={SM.top + S_innerH} x2={SM.left + S_innerW} y2={SM.top + S_innerH} stroke="#999" />
          <line x1={SM.left} y1={SM.top} x2={SM.left} y2={SM.top + S_innerH} stroke="#999" />

          {/* Midlines */}
          <line x1={midX_px} y1={SM.top} x2={midX_px} y2={SM.top + S_innerH} stroke="#aaa" strokeDasharray="4,4" />

          {/* X ticks */}
          {ticks(0, 100, smallScreen ? 4 : 6).map((t, i) => {
            const x = xScale(t);
            return (
              <g key={`xt-${i}`}>
                <line x1={x} y1={SM.top + S_innerH} x2={x} y2={SM.top + S_innerH + 6} stroke="#999" />
                <text x={x} y={SM.top + S_innerH + 18} fontSize={smallScreen ? 10 : 11} textAnchor="middle" fill="#333">
                  {formatNum(t)}
                </text>
              </g>
            );
          })}

          {/* Y ticks */}
          {ticks(0, 100, smallScreen ? 4 : 6).map((t, i) => {
            const y = yScale(t);
            return (
              <g key={`yt-${i}`}>
                <line x1={SM.left - 6} y1={y} x2={SM.left} y2={y} stroke="#999" />
                <text x={SM.left - 10} y={y + 3} fontSize={smallScreen ? 10 : 11} textAnchor="end" fill="#333">
                  {formatNum(t)}
                </text>
              </g>
            );
          })}

          {/* Axis Labels */}
          <text x={SM.left + S_innerW / 2} y={S_HEIGHT - 8} textAnchor="middle" fontSize={12} fill="#333">
            {xKey || "X"}
          </text>
          <text
            x={16}
            y={SM.top + S_innerH / 2}
            transform={`rotate(-90, 16, ${SM.top + S_innerH / 2})`}
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

          {/* Points / Labels */}
          {points.map((d, i) => {
            const px = xScale(d.x);
            const py = yScale(d.y);

            if (smallScreen) {
              return (
                <circle
                  key={`pt-${i}`}
                  cx={px}
                  cy={py}
                  r={4}
                  fill={burntOrange}
                  onPointerEnter={() => setTip({ x: px, y: py - 10, content: `${d.name} (${formatNum(d.x)}, ${formatNum(d.y)})` })}
                  onPointerLeave={() => setTip(null)}
                  onPointerDown={() => setTip({ x: px, y: py - 10, content: `${d.name} (${formatNum(d.x)}, ${formatNum(d.y)})` })}
                />
              );
            }

            let anchor = "middle";
            if (px > S_WIDTH - 40) anchor = "end";
            else if (px < SM.left + 40) anchor = "start";

            return (
              <text
                key={`name-${i}`}
                x={px}
                y={py}
                textAnchor={anchor}
                dominantBaseline="central"
                fontSize={12}
                fontWeight={700}
                fill={burntOrange}
                style={{ pointerEvents: "none" }}
              >
                {d.name ?? ""}
              </text>
            );
          })}

          {/* Drag box */}
          {dragging && box && (
            <rect
              x={Math.min(box.x0, box.x1)}
              y={Math.min(box.y0, box.y1)}
              width={Math.abs(box.y1 - box.y0) ? Math.abs(box.x1 - box.x0) : 0}
              height={Math.abs(box.y1 - box.y0)}
              fill="rgba(191,87,0,0.12)"
              stroke={burntOrange}
              strokeDasharray="4,4"
            />
          )}

          {/* Tooltip (scatter) */}
          {tip && (
            <g transform={`translate(${tip.x}, ${tip.y})`}>
              <rect x={-110} y={-28} width={220} height={24} rx={6} ry={6} fill="rgba(0,0,0,0.75)" />
              <text x={0} y={-12} textAnchor="middle" fontSize={11} fill="#fff">
                {tip.content}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ==== TRENDS LINE CHART CONTROLS ==== */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, color: "#333", fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>
          Sentiment Rankings:
        </div>

        <select
          multiple
          size={Math.min(8, Math.max(4, seriesKeys.length || 4))}
          value={selectedSeries}
          onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
            setSelectedSeries(opts);
          }}
          style={{
            minWidth: 220,
            maxWidth: 320,
            padding: 6,
            borderRadius: 8,
            border: "1px solid #ccc",
            maxHeight: 180,
          }}
          title="Select 1+ series"
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

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            maxWidth: 520,
            justifyContent: "center",
          }}
        >
          {selectedSeries.map((k) => (
            <div key={`lg-${k}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 14, height: 3, background: colorFor(k) }} />
              <span style={{ fontSize: 12 }}>{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ==== TRENDS LINE CHART ==== */}
      <div
        ref={trendsRef}
        style={{
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        <svg width={T_WIDTH} height={T_HEIGHT} style={{ border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
          <line x1={TM.left} y1={TM.top + T_innerH} x2={TM.left + T_innerW} y2={TM.top + T_innerH} stroke="#999" />
          <line x1={TM.left} y1={TM.top} x2={TM.left} y2={TM.top + T_innerH} stroke="#999" />

          {[0, 20, 40, 60, 80, 100].map((val, i) => {
            const y = tyScale(val);
            return (
              <g key={`ty-${i}`}>
                <line x1={TM.left - 6} y1={y} x2={TM.left} y2={y} stroke="#999" />
                <text x={TM.left - 10} y={y + 3} fontSize={10} textAnchor="end" fill="#333">
                  {val}
                </text>
              </g>
            );
          })}

          {timeTicks.map((d, i) => {
            const x = tScale(d);
            return (
              <g key={`tt-${i}`}>
                <line x1={x} y1={TM.top + T_innerH} x2={x} y2={TM.top + T_innerH + 6} stroke="#999" />
                <text x={x} y={TM.top + T_innerH + 18} fontSize={10} textAnchor="middle" fill="#333">
                  {fmtMonth(d)}
                </text>
              </g>
            );
          })}

          <text x={TM.left + T_innerW / 2} y={T_HEIGHT - 8} textAnchor="middle" fontSize={12} fill="#333">
            {timeKey || "Time"}
          </text>
          <text
            x={16}
            y={TM.top + T_innerH / 2}
            transform={`rotate(-90, 16, ${TM.top + T_innerH / 2})`}
            textAnchor="middle"
            fontSize={12}
            fill="#333"
          >
            Sentiment Rank (0–100)
          </text>

          {selectedSeries.map((k) => {
            const pts = trendsPointsBySeries[k] || [];
            const d = buildPath(pts);
            return <path key={`path-${k}`} d={d} fill="none" stroke={colorFor(k)} strokeWidth="2" opacity="0.9" />;
          })}

          {selectedSeries.map((k) => {
            const pts = trendsPointsBySeries[k] || [];
            const every = Math.ceil(pts.length / 60) || 1;
            return pts.map((p, i) => {
              if (i % every !== 0) return null;
              const x = tScale(p.t),
                y = tyScale(p.y);
              const label = `${k}: ${p.y} • ${fmtMonth(p.t)}`;
              return (
                <g key={`hot-${k}-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={6}
                    fill="transparent"
                    stroke="transparent"
                    onPointerEnter={() => setTip({ x, y: y - 12, content: label })}
                    onPointerLeave={() => setTip(null)}
                    onPointerDown={() => setTip({ x, y: y - 12, content: label })}
                  />
                </g>
              );
            });
          })}

          {tip && (
            <g transform={`translate(${clamp(tip.x, TM.left + 60, TM.left + T_innerW - 60)}, ${tip.y})`}>
              <rect x={-110} y={-28} width={220} height={24} rx={6} ry={6} fill="rgba(0,0,0,0.75)" />
              <text x={0} y={-12} textAnchor="middle" fontSize={11} fill="#fff">
                {tip.content}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Disclosure */}
      <div style={{ textAlign: "center", marginTop: 10, padding: "0 8px" }}>
        <span style={{ color: burntOrange, fontSize: "clamp(10px, 2.6vw, 12px)" }}>
          Source: Sports-Reference.com, Google, and Card Ladder with data transformed by Longhorn Cards and
          Collectibles. Composite Rank includes Technical Rank (card prices), Sentiment Rank (Google Trends), and
          Fundamental Rank (player statistics).
        </span>
      </div>

      {(!points.length || !trendsRows.length) && (
        <div style={{ textAlign: "center", marginTop: 14, color: "#666" }}>
          {!points.length &&
            (rows.length ? "No numeric columns found to plot or empty selection." : "Loading composite data…")}
          {!trendsRows.length && <div>Loading Google Trends data…</div>}
        </div>
      )}

      {/* ===== Modal: Search Player Ranks ===== */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              width: "min(760px, 96vw)",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
              padding: 16,
              border: `2px solid ${burntOrange}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: burntOrange,
                  fontSize: "clamp(1.1rem, 3.2vw, 1.4rem)",
                  fontWeight: 800,
                }}
              >
                Search Player Ranks
              </h2>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#333",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Player dropdown */}
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <label htmlFor="playerSelect" style={{ fontWeight: 700 }}>
                Player:
              </label>
              <select
                id="playerSelect"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                style={{
                  minWidth: 260,
                  maxWidth: 420,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #bbb",
                }}
              >
                <option value="">-- Choose a Player --</option>
                {players.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: 12, color: "#666" }}>
                {nameKey ? `Source column: ${nameKey}` : "Player column not detected"}
              </span>
            </div>

            {/* Column availability */}
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
              Missing fields will show as N/A.{" "}
              <span style={{ color: "#333" }}>
                {[
                  ["Composite", compCol],
                  ["Fundamental", fundCol],
                  ["Technical", techCol],
                  ["Sentiment", sentCol],
                  ["Fundamental Change", fundChgCol],
                  ["Rating", ratingCol],
                ]
                  .filter(([, v]) => !v)
                  .map(([label]) => label)
                  .join(", ") || "All required fields found."}
              </span>
            </div>

            {/* Summary card */}
            {selectedPlayer && playerSummary && (
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#222" }}>
                    {selectedPlayer}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {playerSummary.count > 1
                      ? `Aggregated from ${playerSummary.count} rows (averages shown)`
                      : `From 1 row`}
                  </div>
                </div>

                {/* Metrics grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 10,
                  }}
                >
                  {/* Core 0..100 ranks */}
                  {[
                    ["Composite Rank", playerSummary.composite],
                    ["Fundamental Rank", playerSummary.fundamental],
                    ["Technical Rank", playerSummary.technical],
                    ["Sentiment Rank", playerSummary.sentiment],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      style={{
                        background: "#fff",
                        border: "1px solid #e7e7e7",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: burntOrange }}>
                        {val == null || isNaN(val) ? "N/A" : formatNum(val)}
                      </div>
                      {val != null && !isNaN(val) && (
                        <div
                          aria-hidden
                          style={{
                            marginTop: 6,
                            height: 6,
                            background: "#eee",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(val, 0, 100)}%`,
                              height: "100%",
                              background: burntOrange,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Fundamental Change */}
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e7e7e7",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Fundamental Change</div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: (playerSummary.fundChange ?? 0) >= 0 ? "#198754" : "#dc3545",
                      }}
                    >
                      {playerSummary.fundChange == null || isNaN(playerSummary.fundChange)
                        ? "N/A"
                        : `${playerSummary.fundChange >= 0 ? "+" : ""}${formatNum(
                            playerSummary.fundChange
                          )}`}
                    </div>
                  </div>

                  {/* Rating */}
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e7e7e7",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Rating</div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        minHeight: 28,
                      }}
                    >
                      <div
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: 12,
                          color: playerSummary.rating === "Buy" ? "#fff" : "#333",
                          background: playerSummary.rating === "Buy" ? "#198754" : "#e9ecef",
                          border: `1px solid ${
                            playerSummary.rating === "Buy" ? "#198754" : "#ced4da"
                          }`,
                          minWidth: 64,
                          textAlign: "center",
                        }}
                      >
                        {playerSummary.rating ?? "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedPlayer && (
              <div style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
                Choose a player to view Composite, Fundamental, Technical, Sentiment, Fundamental Change, and Rating.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
