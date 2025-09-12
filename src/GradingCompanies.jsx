// src/GradingCompanies.jsx
import React, { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea
} from "recharts";
import { useNavigate } from "react-router-dom";

const BURNT_ORANGE = "#BF5700";

// ---- utils ----
function norm(s) { return String(s ?? "").trim().toLowerCase(); }
function toNumber(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[\$,]/g, "").replace(/\s*(days?|d)\s*$/i, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

// -------------------- Overlap handling --------------------
function computeLabelOffsets(data, xDomain, yDomain) {
  if (!data?.length) return [];
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  const xRange = Math.max(1e-9, xMax - xMin);
  const yRange = Math.max(1e-9, yMax - yMin);
  const xThresh = xRange * 0.06;
  const yThresh = yRange * 0.08;

  const clusters = [];
  data.forEach((d, i) => {
    let found = -1;
    for (let c = 0; c < clusters.length; c++) {
      const seed = clusters[c][0];
      if (Math.abs(d.turnaround - seed.turnaround) < xThresh &&
          Math.abs(d.price - seed.price) < yThresh) { found = c; break; }
    }
    if (found === -1) clusters.push([{ ...d, _idx: i }]);
    else clusters[found].push({ ...d, _idx: i });
  });

  const enriched = data.map((d) => ({ ...d, _dx: 0, _dy: -12, _needsLeader: false, _anchor: "middle" }));

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      const d = cluster[0];
      enriched[d._idx]._dx = 0; enriched[d._idx]._dy = -12;
      enriched[d._idx]._needsLeader = false; enriched[d._idx]._anchor = "middle";
      return;
    }
    const m = cluster.length;
    const radius = 24 + Math.min(12, m) * 3; // px
    const sorted = [...cluster].sort((a, b) => String(a.company).localeCompare(String(b.company)));
    sorted.forEach((d, k) => {
      const angle = (2 * Math.PI * k) / m;
      const dx = Math.round(radius * Math.cos(angle));
      const dy = Math.round(radius * Math.sin(angle));
      enriched[d._idx]._dx = dx; enriched[d._idx]._dy = dy;
      enriched[d._idx]._needsLeader = true;
      enriched[d._idx]._anchor = Math.abs(dx) < 6 ? "middle" : dx < 0 ? "end" : "start";
    });
  });
  return enriched;
}

// Only labels + optional leader line
function LabelShape({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  const dx = payload?._dx ?? 0;
  const dy = payload?._dy ?? -12;
  const needsLeader = !!payload?._needsLeader;
  const anchor = payload?._anchor ?? "middle";
  const company = payload?.company ?? "";
  const lineEndX = cx + (dx === 0 ? 0 : dx * 0.8);
  const lineEndY = cy + (dy === 0 ? 0 : dy * 0.8) - 10;

  return (
    <g>
      {needsLeader && <line x1={cx} y1={cy} x2={lineEndX} y2={lineEndY} stroke="#666" strokeWidth={1} />}
      <text x={cx + dx} y={cy + dy} textAnchor={anchor} fontSize={12} fill="#333" style={{ pointerEvents: "none" }}>
        {company}
      </text>
    </g>
  );
}

// Custom tooltip: company + values
function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #ddd", padding: "8px 10px",
      borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.company}</div>
      <div>Turnaround: {Number(p.turnaround).toFixed(0)} days</div>
      <div>Price: ${Number(p.price).toFixed(0)}</div>
    </div>
  );
}

export default function GradingCompanies() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("Loading Excel…");

  // navigation to Home
  const navigate = useNavigate();
  const goHome = () => {
    try {
      navigate("/");
    } catch {
      window.location.href = "/";
    }
  };

  // --- Zoom state (pixel-based drag anywhere) ---
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 600 });
  const margins = { top: 20, right: 20, bottom: 46, left: 70 };

  const [zoom, setZoom] = useState(null); // { x:[min,max], y:[min,max] } in data units
  const [dragPxStart, setDragPxStart] = useState(null); // {x,y} in pixels (chart coords)
  const [dragPxEnd, setDragPxEnd] = useState(null);

  // Measure container for pixel<->data mapping
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setContainerSize({ width: cr.width, height: cr.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const url = new URL("./assets/Grading_Companies_Data.xlsx?url", import.meta.url);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });

        // first non-empty sheet
        let ws = null;
        for (const name of wb.SheetNames) {
          const sheet = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
          if (rows.length > 0) { ws = sheet; break; }
        }
        if (!ws) throw new Error("No sheets with rows found");

        // auto header detect
        const rowsAoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rowsAoa.length, 30); i++) {
          const row = rowsAoa[i].map((c) => String(c ?? "").trim());
          const lower = row.map(norm);
          const hasCompany = lower.some((c) => c.includes("company") || c === "name" || c === "grader");
          const hasPrice = lower.some((c) => c === "price" || c.includes("price ($)") || c === "fee" || c === "cost");
          const hasTurn = lower.some((c) => c.includes("turnaround") || c === "tat" || c === "days");
          if (hasCompany && hasPrice && hasTurn) { headerRowIdx = i; break; }
        }
        if (headerRowIdx === -1) {
          setStatus("Could not find header row (looked for Company/Price/Turnaround). Check the sheet.");
          setData([]); return;
        }

        const objRows = XLSX.utils.sheet_to_json(ws, { range: headerRowIdx, defval: "" });
        const keys = Object.keys(objRows[0] ?? {}).reduce((acc, k) => { acc[norm(k)] = k; return acc; }, {});
        const companyKey = keys["company"] || keys["name"] || keys["grader"];
        const priceKey = keys["price"] || keys["price ($)"] || keys["fee"] || keys["cost"];
        let turnKey = keys["turnaround"] || Object.keys(keys).find((k) => k.includes("turnaround") || k === "tat" || k === "days");

        if (!companyKey || !priceKey || !turnKey) {
          setStatus("Header names not found. Make sure columns include Company, Price, Turnaround.");
          setData([]); return;
        }

        const cleaned = objRows
          .map((r) => ({
            company: String(r[companyKey] ?? "").trim(),
            price: toNumber(r[priceKey]),
            turnaround: toNumber(r[turnKey]),
          }))
          .filter((d) => d.company && !Number.isNaN(d.price) && !Number.isNaN(d.turnaround));

        setData(cleaned);
        setStatus(cleaned.length ? "" : "No valid numeric rows parsed (see console).");
      } catch (e) {
        console.error("Failed to load/parse Excel:", e);
        setStatus("Failed to load/parse Excel (see console).");
      }
    })();
  }, []);

  // bounds & midpoints
  const stats = useMemo(() => {
    if (!data.length) return null;
    const xVals = data.map(d => d.turnaround);
    const yVals = data.map(d => d.price);
    const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
    const padX = (xMax - xMin) * 0.05 || 1;
    const padY = (yMax - yMin) * 0.05 || 1;
    const xDomainBase = [xMin - padX, xMax + padX];
    const yDomainBase = [yMin - padY, yMax + padY];
    const xMid = (xMin + xMax) / 2;
    const yMid = (yMin + yMax) / 2;
    return { xDomain: xDomainBase, yDomain: yDomainBase, xMid, yMid };
  }, [data]);

  // current domains (apply zoom if present)
  const xDomain = zoom?.x ?? stats?.xDomain ?? ["dataMin - 2", "dataMax + 2"];
  const yDomain = zoom?.y ?? stats?.yDomain ?? ["dataMin - 2", "dataMax + 2"];

  // label data (cluster using base/full domain so offsets stay consistent)
  const dataWithLabelPos = useMemo(() => {
    if (!stats) return data;
    return computeLabelOffsets(data, stats.xDomain, stats.yDomain);
  }, [data, stats]);

  // ---- helpers: find pricing/TAT for a given company (supports aliases) ----
  const companyIndex = useMemo(() => {
    const idx = new Map();
    for (const d of data) {
      const k = norm(d.company);
      if (!idx.has(k)) idx.set(k, d);
    }
    return idx;
  }, [data]);

  const topFacts = useMemo(() => {
    function pick(aliases) {
      for (const a of aliases) {
        const hit = companyIndex.get(norm(a));
        if (hit) return hit;
      }
      return null;
    }
    return {
      psa: pick(["PSA", "Professional Sports Authenticator"]),
      bgs: pick(["BGS", "Beckett", "Beckett Grading Services"]),
      sgc: pick(["SGC", "Sportscard Guaranty", "Sportscard Guaranty Corporation"]),
      cgc: pick(["CGC", "CGC Cards", "Certified Guaranty Company", "CSG"])
    };
  }, [companyIndex]);

  function factsBadge(d) {
    if (!d) return null;
    const fee = Number.isFinite(d.price) ? `~$${Math.round(d.price)}` : "—";
    const tat = Number.isFinite(d.turnaround) ? `${Math.round(d.turnaround)}d TAT` : "—";
    return (
      <span
        style={{
          marginTop: 6,
          display: "inline-block",
          fontSize: 12,
          color: "#444",
          border: "1px solid #ddd",
          borderRadius: 999,
          padding: "2px 8px"
        }}
      >
        {fee} · {tat}
      </span>
    );
  }

  // ---- pixel <-> data converters for the plot area ----
  const plotLeft = margins.left;
  const plotTop = margins.top;
  const plotWidth = Math.max(0, containerSize.width - margins.left - margins.right);
  const plotHeight = Math.max(0, containerSize.height - margins.top - margins.bottom);

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pxToData(px, py) {
    const x0 = xDomain[0], x1 = xDomain[1];
    const y0 = yDomain[0], y1 = yDomain[1];
    const cx = clamp(px, plotLeft, plotLeft + plotWidth);
    const cy = clamp(py, plotTop, plotTop + plotHeight);
    const xr = (cx - plotLeft) / (plotWidth || 1);
    const yr = (cy - plotTop) / (plotHeight || 1);
    const xv = x0 + xr * (x1 - x0);
    const yv = y0 + (1 - yr) * (y1 - y0);
    return { x: xv, y: yv };
  }

  // Box-zoom mouse handlers (pixel-based)
  const onChartMouseDown = (e) => {
    if (e?.chartX == null || e?.chartY == null) return;
    setDragPxStart({ x: e.chartX, y: e.chartY });
    setDragPxEnd(null);
  };
  const onChartMouseMove = (e) => {
    if (!dragPxStart) return;
    if (e?.chartX == null || e?.chartY == null) return;
    setDragPxEnd({ x: e.chartX, y: e.chartY });
  };
  const onChartMouseUp = () => {
    if (!dragPxStart || !dragPxEnd) { setDragPxStart(null); setDragPxEnd(null); return; }
    const a = pxToData(dragPxStart.x, dragPxStart.y);
    const b = pxToData(dragPxEnd.x, dragPxEnd.y);
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);

    // ignore tiny selections
       if (Math.abs(x2 - x1) < 1e-6 || Math.abs(y2 - y1) < 1e-6) {
      setDragPxStart(null); setDragPxEnd(null); return;
    }
    const padX = (x2 - x1) * 0.05 || 0.5;
    const padY = (y2 - y1) * 0.05 || 0.5;
    setZoom({ x: [x1 - padX, x2 + padX], y: [y1 - padY, y2 + padY] });
    setDragPxStart(null); setDragPxEnd(null);
  };
  const resetZoom = () => setZoom(null);

  // Live selection rectangle in data units
  const refArea = (dragPxStart && dragPxEnd)
    ? (() => {
        const a = pxToData(dragPxStart.x, dragPxStart.y);
        const b = pxToData(dragPxEnd.x, dragPxEnd.y);
        return {
          x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x),
          y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y),
        };
      })()
    : null;

  return (
    <div style={{ width: "100%", padding: 20, position: "relative" }}>
      {/* Home button */}
      <button
        onClick={goHome}
        aria-label="Return to Home"
        style={{
          position: "absolute",
          left: 20,
          top: 16,
          background: "#fff",
          border: `1px solid ${BURNT_ORANGE}`,
          color: BURNT_ORANGE,
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer"
        }}
      >
        ← Home
      </button>

      <h2 style={{ color: BURNT_ORANGE, textAlign: "center", marginBottom: 6 }}>
        Grading Companies
      </h2>

      {/* ---- CALCULATOR AT TOP ---- */}
      <GradeDecisionCalculator />
      <hr style={{ margin: "28px 0", border: 0, borderTop: "1px solid #eee" }} />

      {zoom && (
        <button
          onClick={resetZoom}
          style={{
            position: "absolute", right: 28, top: 16,
            background: "#fff", border: `1px solid ${BURNT_ORANGE}`,
            color: BURNT_ORANGE, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
          }}
        >
          Reset Zoom
        </button>
      )}

      {status && (
        <div style={{ textAlign: "center", color: "#666", marginBottom: 8 }}>{status}</div>
      )}

      {/* container measured by ResizeObserver */}
      <div ref={containerRef} style={{ width: "100%", height: 600 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 46, left: 70 }}
            onMouseDown={onChartMouseDown}
            onMouseMove={onChartMouseMove}
            onMouseUp={onChartMouseUp}
          >
            {/* Quadrant shading (always based on full data bounds) */}
            {stats && (
              <>
                <ReferenceArea
                  x1={stats.xDomain[0]} x2={stats.xMid}
                  y1={stats.yDomain[0]} y2={stats.yMid}
                  fill="green" fillOpacity={0.12}
                />
                <ReferenceArea
                  x1={stats.xDomain[0]} x2={stats.xMid}
                  y1={stats.yMid} y2={stats.yDomain[1]}
                  fill="blue" fillOpacity={0.12}
                />
                <ReferenceArea
                  x1={stats.xMid} x2={stats.xDomain[1]}
                  y1={stats.yMid} y2={stats.yDomain[1]}
                  fill="red" fillOpacity={0.12}
                />
                <ReferenceArea
                  x1={stats.xMid} x2={stats.xDomain[1]}
                  y1={stats.yDomain[0]} y2={stats.yMid}
                  fill="yellow" fillOpacity={0.12}
                />
              </>
            )}

            {/* Live selection rectangle */}
            {refArea && (
              <ReferenceArea
                x1={refArea.x1} x2={refArea.x2}
                y1={refArea.y1} y2={refArea.y2}
                stroke={BURNT_ORANGE} strokeOpacity={0.9}
                fill={BURNT_ORANGE} fillOpacity={0.12}
              />
            )}

            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="turnaround"
              label={{ value: "Turnaround (days)", position: "bottom" }}
              domain={xDomain}
              tickFormatter={(val) => Number(val).toFixed(0)}
            />
            <YAxis
              type="number"
              dataKey="price"
              label={{ value: "Price ($)", angle: -90, position: "insideLeft" }}
              domain={yDomain}
              tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "4 2" }} />

            {/* Layer 1: points */}
            <Scatter data={data} fill={BURNT_ORANGE} isAnimationActive={false} />

            {/* Layer 2: labels (above points) */}
            <Scatter data={dataWithLabelPos} shape={<LabelShape />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* --------- Overviews below the chart --------- */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ color: BURNT_ORANGE, textAlign: "center", margin: "8px 0 18px" }}>
          Top-Tier Card Grading Company Overviews
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16
        }}>
          {/* PSA */}
          <section id="psa" style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 16,
            background: "#fff"
          }}>
            <h4 style={{ marginTop: 0, color: BURNT_ORANGE }}>PSA (Professional Sports Authenticator)</h4>
            {factsBadge(topFacts.psa)}
            <p style={{ marginTop: 6 }}>
              Established in 1991, PSA grades on a 10-point scale (with half-point grades where applicable) and
              encapsulates in a tamper-evident holder with a modern LightHouse label. PSA’s population report,
              set registry, and authentication workflow make it one of the hobby’s most recognized options.
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li><b>Best to grade:</b> Broadly collected rookies, key inserts/parallels, and high-visibility issues.</li>
              <li><b>Sweet spots:</b> Eye-appeal copies that meet Gem Mint tolerances for centering/surface.</li>
              <li><b>Notes:</b> Strong marketplace reach and verification features support liquidity for graded cards.</li>
            </ul>
          </section>

          {/* BGS */}
          <section id="bgs" style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 16,
            background: "#fff"
          }}>
            <h4 style={{ marginTop: 0, color: BURNT_ORANGE }}>BGS (Beckett Grading Services)</h4>
            {factsBadge(topFacts.bgs)}
            <p style={{ marginTop: 6 }}>
              Beckett employs a 10-point scale and is known for optional subgrades (centering, corners, edges, surface),
              offering a detailed view of condition. Slabs feature distinct label tiers for elite grades and a
              tamper-resistant case widely used for modern, thick-stock, and autograph/memorabilia cards.
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li><b>Best to grade:</b> Modern and premium cards where subgrades communicate condition granularity.</li>
              <li><b>Sweet spots:</b> Balanced cards targeting Gem Mint or higher outcomes.</li>
              <li><b>Notes:</b> Inner sleeve and tight encapsulation help limit card movement within the holder.</li>
            </ul>
          </section>

          {/* SGC */}
          <section id="sgc" style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 16,
            background: "#fff"
          }}>
            <h4 style={{ marginTop: 0, color: BURNT_ORANGE }}>SGC (Sportscard Guaranty Corporation)</h4>
            {factsBadge(topFacts.sgc)}
            <p style={{ marginTop: 6 }}>
              Founded in 1998 and especially respected for vintage and pre-war material. SGC grades on a 10-point
              scale (with halves) and is known for the “tuxedo” holder—black insert that presents classic designs
              cleanly. Efficiency and consistency are core to its service.
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li><b>Best to grade:</b> Vintage stars, condition-sensitive paper stock, and pre-war issues.</li>
              <li><b>Sweet spots:</b> Eye-appeal vintage where centering/registration stand out.</li>
              <li><b>Notes:</b> Clear, tamper-evident case; growing visibility across modern while keeping vintage strength.</li>
            </ul>
          </section>

          {/* CGC */}
          <section id="cgc" style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 16,
            background: "#fff"
          }}>
            <h4 style={{ marginTop: 0, color: BURNT_ORANGE }}>CGC (Certified Guaranty Company)</h4>
            {factsBadge(topFacts.cgc)}
            <p style={{ marginTop: 6 }}>
              Leveraging decades in comics and collectibles, CGC Cards uses a 10-point scale (with half grades) and
              archival, crystal-clear holders with enhanced label security. Known for consistency and a large TCG
              footprint, with a growing presence in sports.
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li><b>Best to grade:</b> TCG and modern sports where clarity and strict high-end definitions matter.</li>
              <li><b>Sweet spots:</b> Pack-fresh modern with excellent centering/surface targeting Gem/Pristine thresholds.</li>
              <li><b>Notes:</b> Multi-review grading process and anti-counterfeit features support buyer confidence.</li>
            </ul>
          </section>
        </div>

        {/* Small footnote */}
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Tip: Market premiums shift. Compare current service tiers, grading standards, and recent comps for your exact card before submitting.
        </div>
      </div>

      {/* --------- Remaining companies (auto from your Excel) --------- */}
      <OtherCompanies data={data} stats={stats} />
    </div>
  );
}

/** Renders brief overviews for every company not in the top-tier set. */
function OtherCompanies({ data, stats }) {
  const CORE = useMemo(() => new Set(["psa","bgs","sgc","cgc","cgc cards","csg"]), []);
  const remainingCompanies = useMemo(() => {
    const seen = new Set();
    const rest = [];
    for (const d of data) {
      const key = norm(d.company);
      if (CORE.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      rest.push({ company: d.company, price: d.price, turnaround: d.turnaround });
    }
    rest.sort((a, b) => String(a.company).localeCompare(String(b.company)));
    return rest;
  }, [data, CORE]);

  const profileMap = useMemo(() => {
    return {
      "arena": "Arena Club pairs grading with a digital vault/marketplace and a tech-forward submission flow.",
      "arena club": "Arena Club pairs grading with a digital vault/marketplace and a tech-forward submission flow.",

      "ags": "AGS (Automated Grading Systems) emphasizes computer-vision assisted grading with detailed reports.",
      "ags grading": "AGS (Automated Grading Systems) emphasizes computer-vision assisted grading with detailed reports.",

      "dci": "DCI (Dallas Card Investors) is recognized for raw card reviews/pre-grading and encapsulated grading services.",

      "edge": "Edge Grading offers modern slabs and clear condition breakdowns to improve buyer transparency.",

      "fcg": "FCG provides straightforward tiers, optional subgrades, and value-oriented turnaround options.",
      
      "gma": "GMA focuses on fast, affordable grading ideal for bulk submissions.",
      
      "gmg": "GMG targets budget-friendly grading for modern/TCG with simple, consistent tiers.",
      "gem mint graded": "GMG targets budget-friendly grading for modern/TCG with simple, consistent tiers.",

      "hga": "HGA (Hybrid Grading Approach) is known for color-match custom labels and consistency-focused processes.",
      "hybrid grading approach": "HGA (Hybrid Grading Approach) is known for color-match custom labels and consistency-focused processes.",

      "isa": "ISA (International Sports Authentication) highlights experienced graders and simple, affordable service levels.",
      "international sports authentication": "ISA (International Sports Authentication) highlights experienced graders and simple, affordable service levels.",

      "ksa": "KSA Certification (Canada, est. 1996) focuses on consistent, value-conscious grading and authentication.",
      "ksa certification": "KSA Certification (Canada, est. 1996) focuses on consistent, value-conscious grading and authentication.",

      "mnt": "MNT Grading offers multiple service speeds and a modern slab aesthetic with strong presence in Canada.",
      "mnt grading": "MNT Grading offers multiple service speeds and a modern slab aesthetic with strong presence in Canada.",

      "pgi": "PGI (Pristine Grading International) markets low-cost encapsulation/assessment aimed at personal collection display.",
      "pristine grading international": "PGI (Pristine Grading International) markets low-cost encapsulation/assessment aimed at personal collection display.",

      "rare ed.": "Rare Edition leans on AI-assisted inspection and transparent scorecards for repeatable grading.",
      "rare edition": "Rare Edition leans on AI-assisted inspection and transparent scorecards for repeatable grading.",

      "rcg": "Revolution Card Grading advertises flat pricing with included subgrades/auto grades and thick-card support.",
      "revolution card grading": "Revolution Card Grading advertises flat pricing with included subgrades/auto grades and thick-card support.",

      "tag": "TAG Grading uses computer-vision workflows and a published, transparent grading rubric/report.",
      "tag grading": "TAG Grading uses computer-vision workflows and a published, transparent grading rubric/report.",

      "wcg": "WCG (World Class Grading) positions itself as a straightforward, budget-friendly grading option."
    };
  }, []);

  function quickTag(price, turnaround) {
    if (!stats) return "";
    const cost = price >= stats.yMid ? "Premium" : "Budget";
    const speed = turnaround <= stats.xMid ? "Fast" : "Slow";
    return `${cost} • ${speed}`;
  }

  function fmtFacts(price, turnaround) {
    const parts = [];
    if (Number.isFinite(price)) parts.push(`~$${Math.round(price)}`);
    if (Number.isFinite(turnaround)) parts.push(`${Math.round(turnaround)}d TAT`);
    return parts.join(" · ");
  }

  function blurbFor(name, price, turnaround) {
    const key = norm(name);
    const base = profileMap[key];
    const facts = fmtFacts(price, turnaround);
    if (base && facts) return `${base} (${facts}).`;
    if (base) return base;
    return facts ? `Typical service (${facts}).` : `Typical service tiers vary by card value and speed.`;
  }

  if (!remainingCompanies.length) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ color: BURNT_ORANGE, textAlign: "center", margin: "8px 0 18px" }}>
        Brief Overviews: Other Grading Companies
      </h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 14
      }}>
        {remainingCompanies.map((c) => (
          <section key={c.company} id={norm(c.company)} style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 14,
            background: "#fff"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h4 style={{ margin: 0, color: BURNT_ORANGE }}>{c.company}</h4>
              {stats && (
                <span style={{
                  fontSize: 12, color: "#444",
                  border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px"
                }}>
                  {quickTag(c.price, c.turnaround)}
                </span>
              )}
            </div>
            <p style={{ margin: "8px 0 0", lineHeight: 1.35 }}>
              {blurbFor(c.company, c.price, c.turnaround)}
            </p>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
        Note: Verify current fees, tiers, and resale comps for your specific card before submitting.
      </div>
    </div>
  );
}

/* =========================
   Grade Decision Calculator
   ========================= */
function GradeDecisionCalculator() {
  const burntOrange = BURNT_ORANGE;
  const lightHighlight = "#FFF8F3";
  const borderGray = "#ddd";

  // Defaults to match your slide example
  const [gradingCost, setGradingCost] = useState(20);
  const [probPerfect, setProbPerfect] = useState(0.43);
  const [multiplier, setMultiplier] = useState(2);

  const computeRequiredRaw = (gc, p, m) => {
    const denom = p * (m - 1);
    return denom > 0 ? gc / denom : NaN;
  };

  const headlineValue = useMemo(
    () => computeRequiredRaw(gradingCost, probPerfect, multiplier),
    [gradingCost, probPerfect, multiplier]
  );

  const fmtMoney = (x) =>
    isFinite(x) ? x.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2 }) : "—";
  const isClose = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

  return (
    <section style={{ marginTop: 8 }}>
      <h2 style={{ color: burntOrange, textAlign: "center", margin: "0 0 6px" }}>
        To Grade or Not to Grade?
      </h2>

      {/* Explainer */}
      <div
        style={{
          border: `1px solid ${borderGray}`,
          borderLeft: `4px solid ${burntOrange}`,
          background: lightHighlight,
          padding: "12px 14px",
          borderRadius: 8,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        Deciding to grade a card depends on the raw card value, grading cost, probability of a perfect grade,
        and the expected value based on a perfect grade (multiplier).
      </div>

      {/* Formula + Controls */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: burntOrange }}>Raw Card Value Required To Grade</span> ={" "}
        <b>Grading Cost</b> ÷ <b>(Probability × (Multiplier − 1))</b>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 10,
          marginTop: 10,
        }}
      >
        <LabeledInput
          label="Grading Cost ($)"
          value={gradingCost}
          onChange={(v) => setGradingCost(Number(v) || 0)}
          type="number"
          min="0"
          step="1"
        />
        <LabeledInput
          label="Probability of Perfect Grade (0–1)"
          value={probPerfect}
          onChange={(v) => setProbPerfect(Number(v) || 0)}
          type="number"
          min="0"
          max="1"
          step="0.01"
        />
        <LabeledInput
          label="Multiplier (graded ÷ raw)"
          value={multiplier}
          onChange={(v) => setMultiplier(Number(v) || 0)}
          type="number"
          min="1.01"
          step="0.1"
        />
      </div>

      {/* Result */}
      <div
        style={{
          marginTop: 12,
          border: `1px solid ${borderGray}`,
          borderRadius: 8,
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, color: "#555" }}>
          Minimum raw card value to justify grading:
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#111",
            background: lightHighlight,
            border: `1px dashed ${burntOrange}`,
            padding: "6px 10px",
            borderRadius: 8,
          }}
        >
          {fmtMoney(headlineValue)}
        </div>
      </div>

      {/* Matrix */}
      <h3 style={{ color: burntOrange, margin: "18px 0 8px" }}>Probability Matrix</h3>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
        Each cell shows the <b>raw value required</b> for the given Probability (row) and Multiplier (column). Uses your current <b>Grading Cost = {fmtMoney(gradingCost)}</b>.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 560,
            border: `1px solid ${borderGray}`,
          }}
        >
          <thead>
            <tr style={{ background: lightHighlight }}>
              <th
                style={{
                  border: `1px solid ${borderGray}`,
                  padding: "8px 10px",
                  textAlign: "left",
                  fontWeight: 700,
                }}
              >
                Probability ↓ / Multiplier →
              </th>
              {[1.5, 2, 3, 4, 5].map((m) => (
                <th
                  key={`h-${m}`}
                  style={{
                    border: `1px solid ${borderGray}`,
                    padding: "8px 10px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: isClose(m, multiplier) ? "#fff" : "#222",
                    background: isClose(m, multiplier) ? BURNT_ORANGE : lightHighlight,
                  }}
                  title={`Multiplier = ${m.toFixed(2)}`}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0.10, 0.20, 0.30, 0.40, 0.50, 0.43].map((p) => {
              const isPSA = isClose(p, 0.43);
              return (
                <tr key={`r-${p}`} style={{ background: isPSA ? "#f5fff5" : "transparent" }}>
                  <td
                    style={{
                      border: `1px solid ${borderGray}`,
                      padding: "8px 10px",
                      fontWeight: isPSA ? 700 : 500,
                      color: isPSA ? BURNT_ORANGE : "#333",
                    }}
                  >
                    {p.toFixed(2)}{isPSA && <span style={{ marginLeft: 6, fontSize: 12, color: "#2b7a2b" }}>(example 0.43)</span>}
                  </td>
                  {[1.5, 2, 3, 4, 5].map((m) => {
                    const val = computeRequiredRaw(gradingCost, p, m);
                    const highlight = isPSA && isClose(m, 2);
                    return (
                      <td
                        key={`c-${p}-${m}`}
                        style={{
                          border: `1px solid ${borderGray}`,
                          padding: "8px 10px",
                          textAlign: "right",
                          background: highlight ? "#fff3f0" : "transparent",
                          fontWeight: highlight ? 700 : 500,
                          color: highlight ? BURNT_ORANGE : "#222",
                        }}
                        title={`P=${p.toFixed(2)}, Mult=${m}`}
                      >
                        {fmtMoney(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
        Source: Longhorn Cards & Collectibles • Calculator generated by ChatGPT • {new Date().toLocaleDateString()}
      </div>
    </section>
  );
}

// Small labeled input helper
function LabeledInput({ label, value, onChange, type = "text", ...rest }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#444" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          outlineColor: BURNT_ORANGE,
          fontSize: 16,
        }}
      />
    </label>
  );
}
