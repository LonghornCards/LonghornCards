// src/charts/UnifiedScatter.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { autoExtent, ticksFromExtent, formatTick, selectStyle, useContainerWidth } from "../utils/chartUtils";

export default function UnifiedScatter({ data, burntOrange }) {
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

  const [wrapRef, widthPx] = useContainerWidth(600);
  const svgW = widthPx;
  const svgH = Math.max(420, Math.round(svgW * 0.45));

  const filtered = useMemo(() => data.filter((d) => (league === "All" ? true : d.league === league)), [data, league]);
  const rawPoints = useMemo(
    () => filtered.map((d) => ({ ...d, x: d[xKey], y: d[yKey] })).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y)),
    [filtered, xKey, yKey]
  );

  const xVar = VARS.find((v) => v.key === xKey) || VARS[0];
  const yVar = VARS.find((v) => v.key === yKey) || VARS[1];
  const baseXExtent = xVar.fixed ?? autoExtent(rawPoints.map((p) => p.x));
  const baseYExtent = yVar.fixed ?? autoExtent(rawPoints.map((p) => p.y));

  const [viewX, setViewX] = useState(baseXExtent);
  const [viewY, setViewY] = useState(baseYExtent);
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

  const xInv = (px) => { const [a, b] = viewX; return a + (px / W) * (b - a); };
  const yInv = (py) => { const [a, b] = viewY; return a + ((H - py) / H) * (b - a); };

  const clampExtentToBase = (ex, base) => {
    let [a, b] = ex[0] <= ex[1] ? ex : [ex[1], ex[0]];
    const [ba, bb] = base;
    const span = Math.max(1e-6, Math.abs(b - a));
    a = Math.max(ba, Math.min(a, bb - 1e-6));
    b = Math.min(bb, Math.max(b, ba + 1e-6));
    if (b - a < 1e-6) {
      const mid = (a + b) / 2;
      a = mid - span / 2; b = mid + span / 2;
    }
    return [a, b];
  };

  const points = useMemo(
    () => rawPoints.filter((p) => p.x >= Math.min(...viewX) && p.x <= Math.max(...viewX) && p.y >= Math.min(...viewY) && p.y <= Math.max(...viewY)),
    [rawPoints, viewX, viewY]
  );

  const xTicks = ticksFromExtent(viewX, 6);
  const yTicks = ticksFromExtent(viewY, 6);

  const { m, b } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const n = xs.length;
    if (!n) return { m: NaN, b: NaN };
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
    const slope = den === 0 ? NaN : num / den;
    const intercept = Number.isFinite(slope) ? my - slope * mx : NaN;
    return { m: slope, b: intercept };
  }, [points]);

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

  // -------- Tooltip state (HTML overlay) --------
  const [hover, setHover] = useState(null); // { px, py, d }
  const containerRef = useRef(null);

  // Interactions
  const overlayRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [brush, setBrush] = useState(null);

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
      setBrush(null);
    } else if (pointersRef.current.size === 1 && e.pointerType !== "touch" && e.button === 0) {
      setBrush({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
    }
  };

  const findNearest = (px, py) => {
    if (!points.length) return null;
    let best = null;
    let bestDist2 = Infinity;
    for (const d of points) {
      const sx = xScale(d.x);
      const sy = yScale(d.y);
      const dx = sx - px;
      const dy = sy - py;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        best = { d, sx, sy };
      }
    }
    // Only show tooltip if within this pixel radius
    const R = 20; // hover radius in px
    return bestDist2 <= R * R ? best : null;
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const pos = getInnerXY(e);
    pointersRef.current.set(e.pointerId, pos);

    // Update tooltip hover on any move
    const nearest = findNearest(pos.x, pos.y);
    if (nearest) {
      setHover({ px: nearest.sx, py: nearest.sy, d: nearest.d });
    } else {
      setHover(null);
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.hypot(dx, dy);
      const scale = pinchRef.current.startDist / Math.max(1, dist);
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
      setBrush((b) => (b ? { ...b, x1: pos.x, y1: pos.y } : b));
    }
  };

  const onPointerUpCancel = (e) => {
    const hadPinch = pinchRef.current && pointersRef.current.size === 2;
    pointersRef.current.delete(e.pointerId);

    if (hadPinch && pointersRef.current.size < 2) pinchRef.current = null;

    if (brush && (e.type === "pointerup" || e.type === "pointercancel")) {
      const { x0, y0, x1, y1 } = brush;
      const minSel = 6;
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (w > minSel && h > minSel) {
        const xLo = Math.min(x0, x1);
        const xHi = Math.max(x0, x1);
        const yLo = Math.min(y0, y1);
        const yHi = Math.max(y1, y0);
        const newX = clampExtentToBase([xInv(xLo), xInv(xHi)], baseXExtent);
        const newY = clampExtentToBase([yInv(yHi), yInv(yLo)], baseYExtent);
        setViewX(newX);
        setViewY(newY);
      }
      setBrush(null);
    }
  };

  const onPointerLeave = () => {
    setHover(null);
  };

  const selectS = selectStyle(burntOrange);

  // Tooltip positioning relative to the outer container
  const tooltipStyle = (hover) => {
    if (!hover || !containerRef.current) return { display: "none" };
    // Convert inner-plot px (hover.px/py) to page-relative by offsetting margins
    const containerRect = containerRef.current.getBoundingClientRect();
    const left = M.left + hover.px + 12; // small offset
    const top = M.top + hover.py + 12;
    return {
      position: "absolute",
      left,
      top,
      background: "#fff",
      border: `1px solid ${burntOrange}`,
      borderRadius: 8,
      padding: "8px 10px",
      boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      fontSize: 12,
      zIndex: 2,
    };
  };

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontWeight: 700, color: burntOrange }}>X:</label>
          <select value={xKey} onChange={(e) => setXKey(e.target.value)} style={selectS}>
            {VARS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontWeight: 700, color: burntOrange }}>Y:</label>
          <select value={yKey} onChange={(e) => setYKey(e.target.value)} style={selectS}>
            {VARS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
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
          onClick={() => { setViewX(baseXExtent); setViewY(baseYExtent); setBrush(null); }}
          style={{ border: `1px solid ${burntOrange}`, background: "#fff", color: burntOrange, padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontWeight: 700 }}
        >
          Reset Zoom
        </button>
      </div>

      <div ref={containerRef} style={{ position: "relative" }}>
        {/* Floating tooltip */}
        {hover && (
          <div style={tooltipStyle(hover)}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{hover.d.player}{hover.d.league ? ` (${hover.d.league})` : ""}</div>
            <div><strong>{xVar.label}:</strong> {formatTick(hover.d.x)}</div>
            <div><strong>{yVar.label}:</strong> {formatTick(hover.d.y)}</div>
          </div>
        )}

        <svg
          width={svgW}
          height={svgH}
          role="img"
          aria-label="Unified Scatterplot"
          onWheel={onWheel}
          onDoubleClick={onDblClick}
          style={{ touchAction: "none" }}
        >
          <g transform={`translate(${M.left},${M.top})`}>
            {/* Quadrants */}
            <rect x={0} y={0} width={W/2} height={H/2} fill="blue" opacity="0.05" />
            <rect x={W/2} y={0} width={W/2} height={H/2} fill="green" opacity="0.07" />
            <rect x={0} y={H/2} width={W/2} height={H/2} fill="red" opacity="0.06" />
            <rect x={W/2} y={H/2} width={W/2} height={H/2} fill="yellow" opacity="0.10" />

            {/* Axes */}
            <line x1={0} y1={H} x2={W} y2={H} stroke="#ccc" />
            <line x1={0} y1={0} x2={0} y2={H} stroke="#ccc" />

            {/* Grid + Ticks */}
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

            {/* Points + labels */}
            {labels.map((d, idx) => {
              const cx = xScale(d.x);
              const cy = yScale(d.y);
              const isHover = hover && hover.d && hover.d.player === d.player && hover.d.x === d.x && hover.d.y === d.y;
              return (
                <g key={`${d.player}-${idx}`}>
                  {/* Hover highlight ring */}
                  {isHover && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill="none"
                      stroke={burntOrange}
                      strokeWidth={2}
                      opacity="0.85"
                    />
                  )}
                  <circle cx={cx} cy={cy} r={3.5} fill={burntOrange} opacity="0.9" />
                  <text x={d.tx} y={d.ty} fontSize={11} textAnchor="middle" fill="#333">
                    {d.player}
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text x={W / 2} y={H + 40} textAnchor="middle" fontSize="14" fill="#333" fontWeight="700">
              {xVar.label}
            </text>
            <text transform="rotate(-90)" x={-H / 2} y={-56} textAnchor="middle" fontSize="14" fill="#333" fontWeight="700">
              {yVar.label}
            </text>

            {/* Interaction overlay (handles zoom/brush + tooltip detection) */}
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
              onPointerLeave={onPointerLeave}
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
    </div>
  );
}
