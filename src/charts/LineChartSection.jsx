// src/charts/LineChartSection.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useContainerWidth } from "../utils/chartUtils";

function MultiSelect({ options, selected, onChange, max = null, color = "#BF5700", placeholder = "Search & select players…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      const list = document.getElementById("ms-list");
      const box = document.getElementById("ms-box");
      if (list && box && !list.contains(e.target) && !box.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const norm = (s) => (s || "").toLowerCase();
  const filtered = useMemo(() => {
    const q = norm(query);
    const base = q ? options.filter((o) => norm(o).includes(q)) : options;
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

  return (
    <div style={{ position: "relative" }}>
      <div
        id="ms-box"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          minHeight: 40, width: "100%", border: `1px solid ${color}`, borderRadius: 10, padding: "6px 10px", background: "#fff", cursor: "text",
        }}
      >
        {selected.map((s) => (
          <span key={s} style={{
            display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999,
            border: `1px solid ${color}`, background: color, color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 8px",
          }}>
            {s}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(selected.filter((x) => x !== s)); }}
              aria-label={`Remove ${s}`}
              style={{ border: "none", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : placeholder}
          style={{ flex: 1, minWidth: 140, border: "none", outline: "none", fontSize: 13, padding: "4px 2px" }}
        />
      </div>

      {open && (
        <div
          id="ms-list"
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: "absolute", zIndex: 20, top: "calc(100% + 6px)", left: 0, right: 0, maxHeight: 280, overflowY: "auto",
            background: "#fff", border: "1px solid #ddd", borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          }}
        >
          {filtered.length === 0 && <div style={{ padding: 10, fontSize: 12, color: "#777" }}>No matches</div>}

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
                  width: "100%", textAlign: "left", padding: "8px 10px", background: isSel ? "#f7f7f7" : "#fff",
                  border: "none", borderBottom: "1px solid #f1f1f1", cursor: disabled ? "not-allowed" : "pointer",
                  color: disabled ? "#bbb" : "#333", display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                }}
              >
                <input type="checkbox" checked={isSel} readOnly style={{ pointerEvents: "none" }} />
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <small style={{ color: "#777" }}>
          {selected.length}{hasLimit ? `/${max}` : ""} selected
        </small>
      </div>
    </div>
  );
}

export default function LineChartSection({ rankedRows, columns, selectedPlayers, setSelectedPlayers, burntOrange }) {
  const [chartLeague] = useState("All");

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
      return candidates.slice(0, 3).map((e) => e.col);
    });
  }, [playerOptions, rankedRows, setSelectedPlayers]);

  const [wrapRef, widthPx] = useContainerWidth(680);
  const containerRef = useRef(null);

  const WIDTH = widthPx;
  const HEIGHT = 340;
  const MARGIN = { top: 20, right: 20, bottom: 40, left: 46 };
  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const n = rankedRows.length;
  const xLine = (i) => (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yRank = (v) => innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const COLORS = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"];

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

  const xtickCount = 8;
  const xTickIdx = useMemo(() => {
    if (n <= 1) return [0];
    return Array.from({ length: xtickCount }, (_, k) => Math.round((k / (xtickCount - 1)) * (n - 1)));
  }, [n]);

  // ---------------------------
  // Tooltip / Hover state
  // ---------------------------
  const [hoverIdx, setHoverIdx] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0, left: 0, top: 0, visible: false });

  const onMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // mouse position relative to inner plotting area
    const mouseX = e.clientX - rect.left - MARGIN.left;
    const mouseY = e.clientY - rect.top - MARGIN.top;

    if (mouseX < 0 || mouseX > innerW || mouseY < 0 || mouseY > innerH || n <= 0) {
      setHoverIdx(null);
      setTooltip((t) => ({ ...t, visible: false }));
      return;
    }

    const idx = Math.max(0, Math.min(n - 1, Math.round((mouseX / innerW) * (n - 1))));
    const px = xLine(idx);

    // Tooltip HTML box position (clamped inside container)
    const boxW = 220;
    const boxH = 28 + 18 * Math.max(1, selectedPlayers.length);
    let left = MARGIN.left + px + 12;
    if (left + boxW > rect.width) left = MARGIN.left + px - boxW - 12;
    let top = MARGIN.top + mouseY - boxH / 2;
    if (top < 4) top = 4;
    if (top + boxH > rect.height) top = rect.height - boxH - 4;

    setHoverIdx(idx);
    setTooltip({ x: px, y: mouseY, left, top, visible: true });
  };

  const onMouseLeave = () => {
    setHoverIdx(null);
    setTooltip((t) => ({ ...t, visible: false }));
  };

  const hoverDate = hoverIdx != null ? rankedRows[hoverIdx]?.Date : null;
  const hoverPoints = useMemo(() => {
    if (hoverIdx == null) return [];
    const arr = [];
    for (let i = 0; i < selectedPlayers.length; i++) {
      const col = selectedPlayers[i];
      const val = rankedRows[hoverIdx]?.[col];
      if (Number.isFinite(val)) {
        arr.push({
          col,
          val,
          color: COLORS[i % COLORS.length],
          x: xLine(hoverIdx),
          y: yRank(val),
        });
      }
    }
    // show highest rank first (bigger number at top of list)
    arr.sort((a, b) => b.val - a.val);
    return arr;
  }, [hoverIdx, rankedRows, selectedPlayers]);

  return (
    <div style={{ padding: "12px", borderTop: `1px solid ${burntOrange}`, background: "#fff", marginTop: 12 }}>
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

      <div ref={(el) => { wrapRef.current = el; containerRef.current = el; }} style={{ width: "100%", position: "relative" }}>
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label="Player comparison line chart"
             onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ display: "block" }}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Axes grid */}
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <g key={t} transform={`translate(0,${yRank(t)})`}>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                <text x={-8} y={3} textAnchor="end" fontSize="10" fill="#777">{t}</text>
              </g>
            ))}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />

            {/* X ticks (dates) */}
            {xTickIdx.map((i) => {
              const date = rankedRows[i]?.Date;
              return (
                <g key={i} transform={`translate(${xLine(i)},${innerH})`}>
                  <line y1={0} y2={4} stroke="#ccc" />
                  <text y={16} textAnchor="middle" fontSize="10" fill="#777">{date}</text>
                </g>
              );
            })}

            {/* Series paths */}
            {linePaths.map((p) => (
              <path key={p.col} d={p.d} fill="none" stroke={p.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}

            {/* Hover vertical line */}
            {hoverIdx != null && (
              <line
                x1={xLine(hoverIdx)}
                x2={xLine(hoverIdx)}
                y1={0}
                y2={innerH}
                stroke="#999"
                strokeDasharray="3,3"
              />
            )}

            {/* Hover circles at data points */}
            {hoverIdx != null && hoverPoints.map((pt) => (
              <circle key={pt.col} cx={pt.x} cy={pt.y} r={4} fill="#fff" stroke={pt.color} strokeWidth={2} />
            ))}

            {/* Invisible interaction layer */}
            <rect x={0} y={0} width={innerW} height={innerH} fill="transparent" />
          </g>
        </svg>

        {/* HTML Tooltip */}
        {tooltip.visible && hoverIdx != null && (
          <div
            style={{
              position: "absolute",
              left: tooltip.left,
              top: tooltip.top,
              width: 220,
              pointerEvents: "none",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 10,
              boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
              padding: "8px 10px",
              fontSize: 12,
              lineHeight: 1.4,
              zIndex: 5
            }}
            role="tooltip"
            aria-live="polite"
          >
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#333" }}>
              {hoverDate ?? "—"}
            </div>
            {hoverPoints.length === 0 && (
              <div style={{ color: "#777" }}>No data</div>
            )}
            {hoverPoints.map((pt) => (
              <div key={pt.col} style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: pt.color, display: "inline-block" }} />
                <span style={{ color: "#333" }}>{pt.col}</span>
                <span style={{ marginLeft: "auto", color: "#111", fontWeight: 700 }}>{Number(pt.val).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
