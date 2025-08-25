// src/News.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";

/**
 * Sources (all enabled by default)
 * - Yahoo Sports (RSS)
 * - ESPN (RSS)
 * - CBS Sports (RSS)
 * - ABC Sports (RSS)
 * - CLLCT – Memorabilia (HTML)
 * - CLLCT – Sports Cards (HTML)
 *
 * Fetched via AllOrigins to avoid CORS:
 *   https://api.allorigins.win/get?url=<encoded>
 */

const FEEDS = [
  { id: "yahoo", name: "Yahoo Sports", url: "https://sports.yahoo.com/rss/", kind: "rss" },
  { id: "espn", name: "ESPN", url: "https://www.espn.com/espn/rss/news", kind: "rss" },
  { id: "cbs", name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", kind: "rss" },
  { id: "abc", name: "ABC Sports", url: "https://abcnews.go.com/abcnews/sportsheadlines", kind: "rss" },
  { id: "cllct-mem", name: "CLLCT (Memorabilia)", url: "https://www.cllct.com/sports-collectibles/memorabilia", kind: "html" },
  { id: "cllct-cards", name: "CLLCT (Sports Cards)", url: "https://www.cllct.com/sports-collectibles/sports-cards", kind: "html" },
];

const CLLCT_IDS = ["cllct-mem", "cllct-cards"];
const MAJOR_IDS = ["yahoo", "espn", "cbs", "abc"];
const MAX_ITEMS_PER_FEED = 30;

// --- Styles
const COLORS = {
  brand: "#BF5700",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  text: "#1F2937",
  subtext: "#6B7280",
  chip: "#F3F4F6",
  border: "#E5E7EB",
};

// --- Utils
function timeAgo(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - (d?.getTime?.() ?? 0)) / 1000);
  if (!Number.isFinite(s) || s < 0) return "";
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  if (s < 60) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${dy}d ago`;
}
function decodeHTMLEntities(str) {
  const txt = typeof window !== "undefined" ? document.createElement("textarea") : null;
  if (!txt) return str;
  txt.innerHTML = str;
  return txt.value;
}
function stripTags(html) {
  const tmp = typeof window !== "undefined" ? document.createElement("div") : null;
  if (!tmp) return html;
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || "";
  return text.replace(/\s+/g, " ").trim();
}
function sanitizeLink(link) {
  const trimmed = (link || "").trim();
  const m = trimmed.match(/href=["']([^"']+)["']/i);
  return m ? m[1] : trimmed;
}
function safeHostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return "news";
  }
}
function absUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

// --- Fetch helpers
async function fetchViaAllOrigins(url) {
  const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Failed fetching: ${url}`);
  const data = await res.json();
  return data.contents;
}

// --- RSS parsing
function parseRss(xmlText, sourceId, sourceName) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(xml.getElementsByTagName("item"));
  if (!items.length) return [];

  return items.slice(0, MAX_ITEMS_PER_FEED).map((item) => {
    const title = item.getElementsByTagName("title")[0]?.textContent?.trim() || "Untitled";
    const link =
      item.getElementsByTagName("link")[0]?.textContent?.trim() ||
      item.getElementsByTagName("guid")[0]?.textContent?.trim() ||
      "#";
    const pubDate =
      item.getElementsByTagName("pubDate")[0]?.textContent ||
      item.getElementsByTagName("published")[0]?.textContent ||
      item.getElementsByTagName("updated")[0]?.textContent ||
      "";
    const description =
      item.getElementsByTagName("description")[0]?.textContent?.trim() ||
      item.getElementsByTagName("summary")[0]?.textContent?.trim() ||
      "";

    return {
      id: `${sourceId}:${link || title}:${pubDate}`,
      sourceId,
      sourceName,
      title: decodeHTMLEntities(title),
      url: sanitizeLink(link),
      description: stripTags(description),
      date: pubDate ? new Date(pubDate) : null,
    };
  });
}

// --- HTML parsing for CLLCT category pages
function parseCllctCategoryHtml(htmlText, { url, sourceId, sourceName }) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  const base = "https://www.cllct.com";
  const candidates = new Set();

  // Likely article containers
  doc.querySelectorAll("article").forEach((el) => candidates.add(el));

  // Any anchor into /sports-collectibles/ path
  doc.querySelectorAll("a[href*='/sports-collectibles/']").forEach((a) => {
    const article = a.closest("article") || a.closest("[class*='card'],[class*='Card'],li,div");
    candidates.add(article || a);
  });

  // Fallback scan in main region
  const mainSection = doc.querySelector("main") || doc.body;
  if (mainSection) {
    mainSection.querySelectorAll("a[href*='/sports-collectibles/']").forEach((a) => {
      const article = a.closest("article") || a.closest("li") || a;
      candidates.add(article);
    });
  }

  const items = [];
  for (const node of Array.from(candidates)) {
    let a = node.querySelector("a[href*='/sports-collectibles/']") || node.querySelector("a[href^='/']");
    const href = a?.getAttribute?.("href");
    if (!href) continue;
    const link = absUrl(base, href);

    let title =
      a?.getAttribute("title") ||
      a?.textContent?.trim() ||
      node.querySelector("h2,h3,h4")?.textContent?.trim() ||
      "";

    const timeEl = node.querySelector("time");
    const datetime = timeEl?.getAttribute("datetime") || timeEl?.textContent?.trim() || "";
    const date = datetime ? new Date(datetime) : null;

    const desc =
      node.querySelector("p")?.textContent?.trim() ||
      node.querySelector("[class*='dek'],[class*='summary'],[data-field='description']")?.textContent?.trim() ||
      "";

    if (!title || !link) continue;

    items.push({
      id: `${sourceId}:${link}`,
      sourceId,
      sourceName,
      title,
      url: link,
      description: desc,
      date,
    });
  }

  // Dedupe & cap
  const map = new Map();
  for (const it of items) if (!map.has(it.url)) map.set(it.url, it);
  return Array.from(map.values()).slice(0, MAX_ITEMS_PER_FEED);
}

// --- Component
export default function News() {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState("");

  // ✅ all feeds selected by default
  const [activeSources, setActiveSources] = useState(FEEDS.map((f) => f.id));

  // Quick filters
  const [cllctOnly, setCllctOnly] = useState(false);
  const [majorsOnly, setMajorsOnly] = useState(false);

  // Remember user's custom selection to restore after toggles are turned off
  const prevSourcesRef = useRef(activeSources);

  const [query, setQuery] = useState("");

  // If one toggle is turned on, turn the other off
  useEffect(() => {
    if (cllctOnly && majorsOnly) {
      setMajorsOnly(false);
    }
  }, [cllctOnly, majorsOnly]);

  // Apply/restore toggle selections
  useEffect(() => {
    const anyToggleOn = cllctOnly || majorsOnly;

    if (anyToggleOn) {
      // store current custom selection when entering a toggle mode
      prevSourcesRef.current = activeSources;
      if (cllctOnly) setActiveSources(CLLCT_IDS);
      else if (majorsOnly) setActiveSources(MAJOR_IDS);
    } else {
      // restore previous selection (or all if none)
      const restored = prevSourcesRef.current?.length ? prevSourcesRef.current : FEEDS.map((f) => f.id);
      setActiveSources(restored);
    }
  }, [cllctOnly, majorsOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const selected = FEEDS.filter((f) => activeSources.includes(f.id));
      const results = await Promise.allSettled(
        selected.map(async (f) => {
          if (f.kind === "rss") {
            const xml = await fetchViaAllOrigins(f.url);
            return parseRss(xml, f.id, f.name);
          } else if (f.kind === "html") {
            const html = await fetchViaAllOrigins(f.url);
            return parseCllctCategoryHtml(html, { url: f.url, sourceId: f.id, sourceName: f.name });
          }
          return [];
        })
      );

      const merged = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const byUrl = new Map();
      for (const a of merged) {
        const key = a.url || a.id;
        if (!byUrl.has(key)) byUrl.set(key, a);
      }
      const sorted = Array.from(byUrl.values()).sort(
        (a, b) => (b.date?.getTime?.() ?? 0) - (a.date?.getTime?.() ?? 0)
      );
      setArticles(sorted);
    } catch (e) {
      console.error(e);
      setError("We couldn’t load news right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeSources]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.sourceName && a.sourceName.toLowerCase().includes(q))
    );
  }, [articles, query]);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: COLORS.card,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: COLORS.brand,
              color: "#fff",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Home
          </Link>

          <h1 style={{ margin: 0, fontSize: 22, color: COLORS.text }}>
            <span style={{ color: COLORS.brand, fontWeight: 800 }}>Sports</span> News
          </h1>

          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* Quick toggles (mutually exclusive) */}
            <Toggle
              checked={majorsOnly}
              onChange={(v) => {
                setMajorsOnly(v);
                if (v) setCllctOnly(false);
              }}
              label="Major outlets only"
              title="Show only Yahoo, ESPN, CBS, ABC"
            />
            <Toggle
              checked={cllctOnly}
              onChange={(v) => {
                setCllctOnly(v);
                if (v) setMajorsOnly(false);
              }}
              label="CLLCT only"
              title="Show only CLLCT (Memorabilia + Sports Cards)"
            />

            <SourcePicker
              feeds={FEEDS}
              active={activeSources}
              onToggle={(id) => {
                setActiveSources((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
                // manual change exits quick filters
                setCllctOnly(false);
                setMajorsOnly(false);
              }}
              onAll={() => {
                prevSourcesRef.current = FEEDS.map((f) => f.id);
                setActiveSources(FEEDS.map((f) => f.id));
                setCllctOnly(false);
                setMajorsOnly(false);
              }}
              onNone={() => {
                prevSourcesRef.current = [];
                setActiveSources([]);
                setCllctOnly(false);
                setMajorsOnly(false);
              }}
            />

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines…"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                minWidth: 200,
                outline: "none",
              }}
            />
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: COLORS.brand,
                color: "white",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              title="Refresh feeds"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {error && (
          <div
            role="alert"
            style={{
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {loading && !articles.length ? (
          <div style={{ padding: 32, color: COLORS.subtext }}>Loading sports headlines…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, color: COLORS.subtext }}>No articles match your filters.</div>
        ) : (
          <ArticleList articles={filtered} />
        )}
      </main>
    </div>
  );
}

// --- UI bits
function SourcePicker({ feeds, active, onToggle, onAll, onNone }) {
  return (
    <div
      style={{
        background: COLORS.chip,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {feeds.map((f) => {
        const selected = active.includes(f.id);
        return (
          <button
            key={f.id}
            onClick={() => onToggle(f.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: `1px solid ${selected ? COLORS.brand : COLORS.border}`,
              background: selected ? COLORS.brand : "#FFFFFF",
              color: selected ? "#FFFFFF" : COLORS.text,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title={f.url}
          >
            {f.name}
          </button>
        );
      })}
      <div style={{ width: 1, height: 20, background: COLORS.border, margin: "0 4px" }} />
      <button
        onClick={onAll}
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          background: "#FFFFFF",
          color: COLORS.text,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        All
      </button>
      <button
        onClick={onNone}
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          background: "#FFFFFF",
          color: COLORS.text,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        None
      </button>
    </div>
  );
}

function Toggle({ checked, onChange, label, title }) {
  return (
    <label title={title} style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
      <span style={{ fontSize: 12, color: COLORS.subtext }}>{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onChange(!checked);
        }}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          background: checked ? COLORS.brand : "#D1D5DB",
          position: "relative",
          cursor: "pointer",
          transition: "background 120ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            transition: "left 120ms ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </span>
    </label>
  );
}

function ArticleList({ articles }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {articles.map((a) => (
        <ArticleCard key={a.id} a={a} />
      ))}
    </div>
  );
}

function ArticleCard({ a }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 12,
        textDecoration: "none",
        color: "inherit",
        transition: "background 120ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.subtext }} title={a.sourceName}>
          {a.sourceName}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: COLORS.subtext }}>
          {a.date ? timeAgo(a.date) : ""}
        </span>
      </div>
      <h3 style={{ fontSize: 16, lineHeight: 1.3, margin: 0, color: COLORS.text }}>{a.title}</h3>
      {a.description && (
        <p style={{ fontSize: 13, color: COLORS.subtext, margin: "4px 0 0" }}>
          {a.description.length > 160 ? a.description.slice(0, 160) + "…" : a.description}
        </p>
      )}
    </a>
  );
}
