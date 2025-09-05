// src/HomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom"; // ✅ Link for nav
import * as XLSX from "xlsx";
import logo from "./assets/LogoSimple.jpg";
import ebayLogo from "./assets/eBay_Logo.png";

/**
 * Robust asset resolution for the Excel file:
 * - If the file lives in src/assets, use module URL (bundled).
 * - Else, fallback to public path: /src-assets/Composite_Ranks_Data.xlsx
 */
let compUrl;
try {
  compUrl = new URL("./assets/Composite_Ranks_Data.xlsx?url", import.meta.url).href; // src/assets
} catch {
  compUrl = "/src-assets/Composite_Ranks_Data.xlsx"; // public/src-assets
}

export default function HomePage() {
  const burntOrange = "#BF5700"; // Primary color
  const lightHighlight = "#FFF8F3"; // Subtle background tint

  // --- Modal state (Composite) ---
  const [openComposite, setOpenComposite] = useState(false);
  const [rowsComposite, setRowsComposite] = useState([]);
  const [loadingComposite, setLoadingComposite] = useState(false);
  const [errComposite, setErrComposite] = useState("");

  // --- Modal state (Fundamental) ---
  const [openFund, setOpenFund] = useState(false);
  const [rowsFund, setRowsFund] = useState([]);
  const [loadingFund, setLoadingFund] = useState(false);
  const [errFund, setErrFund] = useState("");

  // --- Modal state (Sentiment) ---
  const [openSent, setOpenSent] = useState(false);
  const [rowsSent, setRowsSent] = useState([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [errSent, setErrSent] = useState("");

  // --- Modal state (Technical) ---
  const [openTech, setOpenTech] = useState(false);
  const [rowsTech, setRowsTech] = useState([]);
  const [loadingTech, setLoadingTech] = useState(false);
  const [errTech, setErrTech] = useState("");

  // Helpers to normalize headers / get columns
  const normalizeHeader = (s) =>
    String(s ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();

  const headerAliases = useMemo(
    () => ({
      player: [
        "PLAYER",
        "NAME",
        "PLAYER NAME",
        "PLAYER_NAME",
        "ATHLETE",
        "ATHLETE NAME",
      ],
      composite: [
        "COMPOSITE RANK",
        "COMPOSITE_RANK",
        "COMPOSITE",
        "RANK (COMPOSITE)",
        "COMPOSITE SCORE",
        "COMPOSITE_SCORE",
        "SCORE",
      ],
      fundamental: [
        "FUNDAMENTAL RANK",
        "FUNDAMENTAL_RANK",
        "FUNDAMENTAL",
        "RANK (FUNDAMENTAL)",
        "FUNDAMENTAL SCORE",
        "FUNDAMENTAL_SCORE",
        "FUND SCORE",
      ],
      sentiment: [
        "SENTIMENT RANK",
        "SENTIMENT_RANK",
        "SENTIMENT",
        "RANK (SENTIMENT)",
        "SENTIMENT SCORE",
        "SENTIMENT_SCORE",
        "SENT SCORE",
      ],
      technical: [
        "TECHNICAL RANK",
        "TECHNICAL_RANK",
        "TECHNICAL",
        "RANK (TECHNICAL)",
        "TECHNICAL SCORE",
        "TECHNICAL_SCORE",
        "TECH SCORE",
      ],
    }),
    []
  );

  // Generic loader for Top-25 by a given score column
  const loadTop25 = async ({ setLoading, setErr, setRows, scoreKeyAliases }) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(compUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
      const buf = await res.arrayBuffer();

      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Raw rows (header:1) so we can normalize headers precisely
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!raw.length) throw new Error("Excel sheet is empty.");

      // Normalize headers and build row objects
      const headers = raw[0].map((h) => normalizeHeader(h));
      const dataRows = raw.slice(1).map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = r[i];
        });
        return obj;
      });

      const findFirstExisting = (aliases) => {
        for (const a of aliases) {
          const key = normalizeHeader(a);
          if (headers.includes(key)) return key;
        }
        return null;
      };

      const playerKey = findFirstExisting(headerAliases.player);
      const scoreKey = findFirstExisting(scoreKeyAliases);

      if (!playerKey || !scoreKey) {
        throw new Error(
          `Could not find expected columns. Looked for Player in [${headerAliases.player.join(
            ", "
          )}] and Score in [${scoreKeyAliases.join(", ")}].`
        );
      }

      // Build clean rows: { player, score }
      const cleaned = dataRows
        .map((r) => {
          const player = String(r[playerKey] ?? "").trim();
          const rawScore = r[scoreKey];
          let score = Number(
            typeof rawScore === "string" ? rawScore.replace(/[^0-9.\-]/g, "") : rawScore
          );
          if (!Number.isFinite(score)) score = NaN;
          return { player, score };
        })
        .filter((x) => x.player && Number.isFinite(x.score));

      // Sort by score DESC (100 best → 0 worst), tie-break by player
      cleaned.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.player.localeCompare(b.player);
      });

      // Deduplicate by player (keep best)
      const seen = new Set();
      const unique = [];
      for (const r of cleaned) {
        if (!seen.has(r.player)) {
          seen.add(r.player);
          unique.push(r);
        }
      }

      setRows(unique.slice(0, 25));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Load when each modal opens
  useEffect(() => {
    if (!openComposite) return;
    let cancel = false;
    (async () => {
      await loadTop25({
        setLoading: (v) => !cancel && setLoadingComposite(v),
        setErr: (v) => !cancel && setErrComposite(v),
        setRows: (v) => !cancel && setRowsComposite(v),
        scoreKeyAliases: headerAliases.composite,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [openComposite, headerAliases]);

  useEffect(() => {
    if (!openFund) return;
    let cancel = false;
    (async () => {
      await loadTop25({
        setLoading: (v) => !cancel && setLoadingFund(v),
        setErr: (v) => !cancel && setErrFund(v),
        setRows: (v) => !cancel && setRowsFund(v),
        scoreKeyAliases: headerAliases.fundamental,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [openFund, headerAliases]);

  useEffect(() => {
    if (!openSent) return;
    let cancel = false;
    (async () => {
      await loadTop25({
        setLoading: (v) => !cancel && setLoadingSent(v),
        setErr: (v) => !cancel && setErrSent(v),
        setRows: (v) => !cancel && setRowsSent(v),
        scoreKeyAliases: headerAliases.sentiment,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [openSent, headerAliases]);

  useEffect(() => {
    if (!openTech) return;
    let cancel = false;
    (async () => {
      await loadTop25({
        setLoading: (v) => !cancel && setLoadingTech(v),
        setErr: (v) => !cancel && setErrTech(v),
        setRows: (v) => !cancel && setRowsTech(v),
        scoreKeyAliases: headerAliases.technical,
      });
    })();
    return () => {
      cancel = true;
    };
  }, [openTech, headerAliases]);

  // Close on ESC for all dialogs
  useEffect(() => {
    if (!openComposite && !openFund && !openSent && !openTech) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenComposite(false);
        setOpenFund(false);
        setOpenSent(false);
        setOpenTech(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openComposite, openFund, openSent, openTech]);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        textAlign: "center",
        color: "#222",
        backgroundColor: "#fff",
      }}
    >
      {/* Navigation Menu */}
      <nav
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "30px",
          marginBottom: "30px",
          borderBottom: `2px solid ${burntOrange}`,
          paddingBottom: "10px",
          backgroundColor: "#fafafa",
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Home
        </Link>

        {/* ✅ Feeds link */}
        <Link
          to="/feeds"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Feeds
        </Link>

        {/* 🚫 News link removed */}

        <Link
          to="/history"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          History of Sports Cards
        </Link>

        <Link
          to="/research"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Research
        </Link>

        {/* ✅ Blog link (next to Research) */}
        <Link
          to="/blog"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          Blog
        </Link>
      </nav>

      {/* Logo + Business Name */}
      <div style={{ marginBottom: "40px" }}>
        <img
          src={logo}
          alt="Longhorn Cards & Collectibles Logo"
          style={{
            width: "400px",
            maxWidth: "90%",
            marginBottom: "20px",
          }}
        />
        <h1 style={{ fontSize: "3rem", margin: 0, color: burntOrange }}>
          Longhorn Cards & Collectibles
        </h1>
      </div>

      {/* Overview */}
      <p
        style={{
          fontSize: "1.1rem",
          maxWidth: "650px",
          margin: "0 auto 30px auto",
          lineHeight: "1.6",
        }}
      >
        Welcome to <strong>Longhorn Cards & Collectibles</strong> — your trusted
        source for buying and selling sports cards and memorabilia across{" "}
        <strong>baseball</strong>, <strong>football</strong>, and{" "}
        <strong>basketball</strong>. Whether you're a seasoned collector or just
        getting started, we provide quality cards, rare finds, and authentic
        memorabilia.
      </p>

      {/* eBay Store Section */}
      <section
        style={{
          maxWidth: "750px",
          margin: "50px auto",
          padding: "30px 20px",
          textAlign: "center",
          backgroundColor: "#fff",
          border: `3px solid ${burntOrange}`,
          borderRadius: "10px",
          boxShadow: "0px 3px 8px rgba(0,0,0,0.05)",
        }}
      >
        <img
          src={ebayLogo}
          alt="eBay Logo"
          style={{ width: "120px", maxWidth: "40%", marginBottom: "15px" }}
        />
        <h2
          style={{
            fontSize: "1.8rem",
            marginBottom: "15px",
            color: burntOrange,
          }}
        >
          Shop Our eBay Store
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}
        >
          Discover our latest listings of baseball, football, and basketball
          cards as well as unique sports and historical memorabilia — all
          available exclusively on eBay.
        </p>
        <a
          href="https://ebay.us/m/Zaq5Bf"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            backgroundColor: burntOrange,
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "1.1rem",
            textDecoration: "none",
            transition: "background-color 0.3s ease",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#993F00")}
          onMouseOut={(e) => (e.target.style.backgroundColor = burntOrange)}
        >
          Visit Longhorn Cards on eBay
        </a>
      </section>

      {/* Download History Section */}
      <section
        style={{
          maxWidth: "750px",
          margin: "30px auto",
          padding: "30px 20px",
          textAlign: "center",
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0px 3px 8px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            fontSize: "1.8rem",
            marginBottom: "15px",
            color: burntOrange,
          }}
        >
          Download History of Sports Trading Cards
        </h2>
        <p
          style={{
            fontSize: "1.1rem",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}
        >
          Learn more about the evolution of trading cards through our
          comprehensive guide.
        </p>
        <a
          href="/History_Of_Trading_Cards.pdf"
          download
          style={{
            display: "inline-block",
            backgroundColor: burntOrange,
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "1.1rem",
            textDecoration: "none",
            transition: "background-color 0.3s ease",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#993F00")}
          onMouseOut={(e) => (e.target.style.backgroundColor = burntOrange)}
        >
          Download PDF
        </a>
      </section>

      {/* Quantitative Process Section */}
      <section
        style={{
          fontSize: "1rem",
          maxWidth: "700px",
          margin: "40px auto",
          padding: "20px",
          lineHeight: "1.7",
          textAlign: "left",
          backgroundColor: lightHighlight,
          borderRadius: "8px",
          boxShadow: "0px 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "15px",
            textAlign: "center",
            color: burntOrange,
          }}
        >
          Our Quantitative Card Selection Process
        </h2>
        <p>
          At Longhorn Cards & Collectibles, we use a structured, data-driven
          approach to evaluate cards from both <strong>retired legends</strong>{" "}
          and <strong>active players</strong> across baseball, football, and
          basketball. Our process combines:
        </p>
        <ul style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>
            <strong>Fundamental Analysis</strong> — assessing player career
            statistics, career achievements, awards, and historical significance.
          </li>
          <li>
            <strong>Technical Analysis</strong> — tracking market price trends,
            trading volumes, and chart patterns to identify entry and exit
            points.
          </li>
          <li>
            <strong>Sentiment Analysis</strong> — evaluating Google Trends, fan
            demand, media coverage, and cultural impact to gauge short- and
            long-term card interest.
          </li>
        </ul>
        <p>
          By blending these three perspectives, we aim to offer collectors cards
          with both lasting historical significance and near-term market appeal.
        </p>
      </section>

      {/* ✅ NEW: Buttons under the Quant section to open the Top 25 modals */}
      <div style={{ marginTop: "-10px", marginBottom: "30px" }}>
        <div
          style={{
            display: "inline-flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Composite */}
          <button
            onClick={() => setOpenComposite(true)}
            style={{
              background: "transparent",
              color: burntOrange,
              border: `2px solid ${burntOrange}`,
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-haspopup="dialog"
            aria-expanded={openComposite ? "true" : "false"}
            aria-controls="top25-modal-composite"
          >
            View Top 25 by Composite Rank
          </button>

          {/* Fundamental */}
          <button
            onClick={() => setOpenFund(true)}
            style={{
              background: "transparent",
              color: burntOrange,
              border: `2px solid ${burntOrange}`,
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-haspopup="dialog"
            aria-expanded={openFund ? "true" : "false"}
            aria-controls="top25-modal-fundamental"
          >
            View Top 25 by Fundamental Rank
          </button>

          {/* Sentiment */}
          <button
            onClick={() => setOpenSent(true)}
            style={{
              background: "transparent",
              color: burntOrange,
              border: `2px solid ${burntOrange}`,
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-haspopup="dialog"
            aria-expanded={openSent ? "true" : "false"}
            aria-controls="top25-modal-sentiment"
          >
            View Top 25 by Sentiment Rank
          </button>

          {/* Technical */}
          <button
            onClick={() => setOpenTech(true)}
            style={{
              background: "transparent",
              color: burntOrange,
              border: `2px solid ${burntOrange}`,
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
            aria-haspopup="dialog"
            aria-expanded={openTech ? "true" : "false"}
            aria-controls="top25-modal-technical"
          >
            View Top 25 by Technical Rank
          </button>
        </div>
        <div style={{ fontSize: "0.85rem", marginTop: "8px", color: "#666" }}></div>
      </div>

      {/* About Us Section */}
      <section
        style={{
          fontSize: "1rem",
          maxWidth: "700px",
          margin: "40px auto",
          padding: "20px",
          lineHeight: "1.7",
          textAlign: "left",
          backgroundColor: lightHighlight,
          borderRadius: "8px",
          boxShadow: "0px 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            marginBottom: "15px",
            textAlign: "center",
            color: burntOrange,
          }}
        >
          About Us
        </h2>
        <p>
          Based in <strong>Austin, TX</strong>, Longhorn Cards & Collectibles is
          dedicated to buying and selling <strong>baseball</strong>,{" "}
          <strong>football</strong>, and <strong>basketball</strong> cards, as
          well as collecting unique sports and historical memorabilia.
        </p>
        <p>
          We operate exclusively through <strong>eBay</strong>, giving collectors
          a trusted platform to access our curated selection of cards and
          memorabilia.
        </p>
        <p>
          As part of our mission to find the <em>highest quality</em> cards with
          the strongest potential for long-term appreciation, we employ our own
          proprietary <strong>quantitative process</strong>. This process blends{" "}
          <strong>fundamental</strong>, <strong>technical</strong>, and{" "}
          <strong>sentiment analysis</strong> to identify and offer only the best
          opportunities for collectors.
        </p>
      </section>

      {/* ===== Footer: Instagram link (bottom of page) ===== */}
      <footer
        style={{
          borderTop: `2px solid ${burntOrange}`,
          marginTop: "40px",
          paddingTop: "16px",
          paddingBottom: "8px",
        }}
      >
        <a
          href="https://www.instagram.com/longhorncardsatx?igsh=NXhvY2c4dG1senZz&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open @longhorncardsatx on Instagram (opens in new tab)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: burntOrange,
            fontWeight: "bold",
            textDecoration: "none",
            fontSize: "1.05rem",
          }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          {/* Inline Instagram icon (SVG) */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2.2a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6zM17.5 6a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
          Follow us on Instagram @longhorncardsatx
        </a>
      </footer>

      {/* ===== Modal: Composite (Scrollable) ===== */}
      {openComposite && (
        <div
          role="dialog"
          aria-modal="true"
          id="top25-modal-composite"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenComposite(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: "720px",
              width: "100%",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #eee",
                background: lightHighlight,
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: burntOrange }}>
                Top 25 Players · Composite Rank
              </h3>
              <button
                onClick={() => setOpenComposite(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                ×
              </button>
            </header>

            <div style={{ padding: "16px 18px", overflowY: "auto", flexGrow: 1 }}>
              {loadingComposite && (
                <div style={{ padding: "12px 0" }}>Loading top 25…</div>
              )}
              {errComposite && (
                <div
                  style={{
                    padding: "12px",
                    background: "#fff1f0",
                    border: "1px solid #ffd6d6",
                    borderRadius: "8px",
                    color: "#a10000",
                    marginBottom: "12px",
                  }}
                >
                  {errComposite}
                </div>
              )}

              {!loadingComposite && !errComposite && (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.95rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Player
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Composite Rank
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsComposite.map((r, i) => (
                        <tr key={`${r.player}-${i}`}>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              width: "48px",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                            }}
                          >
                            {r.player}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color:
                                r.score >= 85
                                  ? "#0a8f00"
                                  : r.score >= 60
                                  ? "#cc7a00"
                                  : "#a10000",
                            }}
                          >
                            {Number(r.score).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                      {!rowsComposite.length && (
                        <tr>
                          <td colSpan={3} style={{ padding: "12px" }}>
                            No rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                Note: Higher composite = better (100 best · 0 worst).
              </div>
            </div>

            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "12px 18px",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setOpenComposite(false)}
                style={{
                  background: burntOrange,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== Modal: Fundamental (Scrollable) ===== */}
      {openFund && (
        <div
          role="dialog"
          aria-modal="true"
          id="top25-modal-fundamental"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenFund(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: "720px",
              width: "100%",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #eee",
                background: lightHighlight,
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: burntOrange }}>
                Top 25 Players · Fundamental Rank
              </h3>
              <button
                onClick={() => setOpenFund(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                ×
              </button>
            </header>

            <div style={{ padding: "16px 18px", overflowY: "auto", flexGrow: 1 }}>
              {loadingFund && <div style={{ padding: "12px 0" }}>Loading top 25…</div>}
              {errFund && (
                <div
                  style={{
                    padding: "12px",
                    background: "#fff1f0",
                    border: "1px solid #ffd6d6",
                    borderRadius: "8px",
                    color: "#a10000",
                    marginBottom: "12px",
                  }}
                >
                  {errFund}
                </div>
              )}

              {!loadingFund && !errFund && (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.95rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Player
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Fundamental Rank
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsFund.map((r, i) => (
                        <tr key={`${r.player}-${i}`}>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              width: "48px",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                            }}
                          >
                            {r.player}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color:
                                r.score >= 85
                                  ? "#0a8f00"
                                  : r.score >= 60
                                  ? "#cc7a00"
                                  : "#a10000",
                            }}
                          >
                            {Number(r.score).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                      {!rowsFund.length && (
                        <tr>
                          <td colSpan={3} style={{ padding: "12px" }}>
                            No rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                Note: Higher fundamental = better (100 best · 0 worst).
              </div>
            </div>

            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "12px 18px",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setOpenFund(false)}
                style={{
                  background: burntOrange,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== Modal: Sentiment (Scrollable) ===== */}
      {openSent && (
        <div
          role="dialog"
          aria-modal="true"
          id="top25-modal-sentiment"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenSent(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: "720px",
              width: "100%",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #eee",
                background: lightHighlight,
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: burntOrange }}>
                Top 25 Players · Sentiment Rank
              </h3>
              <button
                onClick={() => setOpenSent(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                ×
              </button>
            </header>

            <div style={{ padding: "16px 18px", overflowY: "auto", flexGrow: 1 }}>
              {loadingSent && <div style={{ padding: "12px 0" }}>Loading top 25…</div>}
              {errSent && (
                <div
                  style={{
                    padding: "12px",
                    background: "#fff1f0",
                    border: "1px solid #ffd6d6",
                    borderRadius: "8px",
                    color: "#a10000",
                    marginBottom: "12px",
                  }}
                >
                  {errSent}
                </div>
              )}

              {!loadingSent && !errSent && (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.95rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Player
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Sentiment Rank
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsSent.map((r, i) => (
                        <tr key={`${r.player}-${i}`}>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              width: "48px",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                            }}
                          >
                            {r.player}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color:
                                r.score >= 85
                                  ? "#0a8f00"
                                  : r.score >= 60
                                  ? "#cc7a00"
                                  : "#a10000",
                            }}
                          >
                            {Number(r.score).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                      {!rowsSent.length && (
                        <tr>
                          <td colSpan={3} style={{ padding: "12px" }}>
                            No rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                Note: Higher sentiment = better (100 best · 0 worst).
              </div>
            </div>

            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "12px 18px",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setOpenSent(false)}
                style={{
                  background: burntOrange,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "bold",
                }}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ===== Modal: Technical (Scrollable) ===== */}
      {openTech && (
        <div
          role="dialog"
          aria-modal="true"
          id="top25-modal-technical"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenTech(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: "720px",
              width: "100%",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #eee",
                background: lightHighlight,
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: burntOrange }}>
                Top 25 Players · Technical Rank
              </h3>
              <button
                onClick={() => setOpenTech(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "#333",
                }}
              >
                ×
              </button>
            </header>

            <div style={{ padding: "16px 18px", overflowY: "auto", flexGrow: 1 }}>
              {loadingTech && <div style={{ padding: "12px 0" }}>Loading top 25…</div>}
              {errTech && (
                <div
                  style={{
                    padding: "12px",
                    background: "#fff1f0",
                    border: "1px solid #ffd6d6",
                    borderRadius: "8px",
                    color: "#a10000",
                    marginBottom: "12px",
                  }}
                >
                  {errTech}
                </div>
              )}

              {!loadingTech && !errTech && (
                <div
                  style={{
                    overflowX: "auto",
                    border: "1px solid #eee",
                    borderRadius: "8px",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.95rem",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Player
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "10px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          Technical Rank
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsTech.map((r, i) => (
                        <tr key={`${r.player}-${i}`}>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              width: "48px",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                            }}
                          >
                            {r.player}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #f2f2f2",
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                              color:
                                r.score >= 85
                                  ? "#0a8f00"
                                  : r.score >= 60
                                  ? "#cc7a00"
                                  : "#a10000",
                            }}
                          >
                            {Number(r.score).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                      {!rowsTech.length && (
                        <tr>
                          <td colSpan={3} style={{ padding: "12px" }}>
                            No rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginTop: "10px",
                }}
              >
                Note: Higher technical = better (100 best · 0 worst).
              </div>
            </div>

            <footer
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                padding: "12px 18px",
                borderTop: "1px solid #eee",
                background: "#fafafa",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setOpenTech(false)}
                style={{
                  background: burntOrange,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
      {/* ===== End Modals ===== */}
    </div>
  );
}
