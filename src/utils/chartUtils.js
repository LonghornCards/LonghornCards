// src/utils/chartUtils.js

// ---------- Date parsing for month headers ----------
export function parseMonthHeader(h) {
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
export function monthIndexFromName(name) {
  const m = name.toLowerCase().slice(0, 3);
  const arr = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const idx = arr.indexOf(m);
  return idx === -1 ? null : idx;
}
export function toMonthStartISO(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dt = new Date(Date.UTC(y, m, 1));
  return dt.toISOString().slice(0, 10);
}

// ---------- Small data helpers ----------
export function toFiniteNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("<")) return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
export function toASCII(s) {
  if (typeof s !== "string") return s;
  let out = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out
    .replace(/ß/g, "ss").replace(/Đ/g, "D").replace(/đ/g, "d")
    .replace(/Ł/g, "L").replace(/ł/g, "l").replace(/Ø/g, "O").replace(/ø/g, "o")
    .replace(/Æ/g, "AE").replace(/æ/g, "ae").replace(/Œ/g, "OE").replace(/œ/g, "oe");
  return out;
}
export function titleCaseFromKey(k) {
  const parts = String(k || "").split(/[\s._-]+/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
export function sportToLeague(s) {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "";
  if (v.startsWith("foot")) return "NFL";
  if (v.startsWith("basket")) return "NBA";
  if (v.startsWith("base")) return "MLB";
  if (["mlb", "nba", "nfl"].includes(v)) return v.toUpperCase();
  return "";
}

// ---------- Scales, ticks, formatting ----------
export function autoExtent(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.08 || 1;
  return [min - pad, max + pad];
}
export function ticksFromExtent([min, max], n = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => roundNice(min + i * step));
}
export function roundNice(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v);
  if (abs >= 100) return Math.round(v * 10) / 10;
  if (abs >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}
export function formatTick(v) {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toString();
  if (abs >= 100) return (Math.round(v * 10) / 10).toString();
  if (abs >= 1) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}
export function selectStyle(color) {
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

// ---------- Shared width hook ----------
import { useEffect, useRef, useState } from "react";
export function useContainerWidth(minWidth = 480) {
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
