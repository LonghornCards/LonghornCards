// src/Blog.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "./assets/LogoSimple.jpg"; // ✅ import logo from src-assets

export default function Blog() {
  // Image modal state (pixel-accurate zoom)
  const [enlarged, setEnlarged] = useState(null); // { src, naturalWidth, naturalHeight }
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef(null);

  // PDF modal state
  const [pdfSrc, setPdfSrc] = useState(null);

  // TOC (dropdown) + search state
  const containerRef = useRef(null);
  const [toc, setToc] = useState([]); // [{ id, title }]
  const [titleFilter, setTitleFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");

  // Date filter state
  const [dateOptions, setDateOptions] = useState([]); // [{ key: "2025-08", label: "August 2025", count }]
  const [dateFilter, setDateFilter] = useState(""); // "YYYY-MM" or ""

  const location = useLocation();
  const navigate = useNavigate();

  // Close with ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setEnlarged(null);
        setPdfSrc(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // When a new image opens, start at Fit
  useLayoutEffect(() => {
    if (!enlarged || !viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const fitZ = Math.min(
      vw / enlarged.naturalWidth,
      vh / enlarged.naturalHeight,
      1
    );
    setZoom(fitZ > 0 ? +fitZ.toFixed(3) : 1);
    requestAnimationFrame(() => {
      const wrap = viewportRef.current?.firstChild;
      if (wrap) {
        viewportRef.current.scrollLeft = (wrap.scrollWidth - vw) / 2;
        viewportRef.current.scrollTop = (wrap.scrollHeight - vh) / 2;
      }
    });
  }, [enlarged]);

  // Helpers for parsing month/year from "(Month YYYY)" in H2 text
  const MONTHS = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december"
  ];
  const monthToIndex = (m) => MONTHS.indexOf(m.toLowerCase()); // 0-11

  const parseMonthKeyFromTitle = (titleText) => {
    // Expect something like: "... (August 2025)" (parentheses at end)
    const match = titleText.match(/\((January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\)\s*$/i);
    if (!match) return null;
    const monthName = match[1];
    const yearStr = match[2];
    const mIdx = monthToIndex(monthName);
    if (mIdx === -1) return null;
    const ym = `${yearStr}-${String(mIdx + 1).padStart(2,"0")}`; // "YYYY-MM"
    return { key: ym, label: `${monthName} ${yearStr}` };
  };

  // Build TOC + Date options from article h2s (assign IDs if missing)
  useEffect(() => {
    if (!containerRef.current) return;

    const headings = Array.from(
      containerRef.current.querySelectorAll("article h2")
    );

    // safe slug generator
    const seen = new Set();
    const safeSlug = (text) => {
      const base = (text || "post")
        .toLowerCase()
        .replace(/["“”]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 80) || "post";
      let s = base;
      let n = 2;
      while (seen.has(s)) s = `${base}-${n++}`;
      seen.add(s);
      return s;
    };

    // Build TOC and tag each article with a data-month key
    const builtToc = [];
    const monthMap = new Map(); // key -> { label, count }
    headings.forEach((h) => {
      if (!h.id) h.id = safeSlug(h.textContent || "post");
      builtToc.push({ id: h.id, title: h.textContent || h.id });

      // find the article element and attach the parsed month key if available
      const articleEl = h.closest("article");
      const parsed = parseMonthKeyFromTitle(h.textContent || "");
      if (articleEl && parsed) {
        articleEl.setAttribute("data-month", parsed.key);
        // count for dropdown
        const prev = monthMap.get(parsed.key) || { label: parsed.label, count: 0 };
        monthMap.set(parsed.key, { label: parsed.label, count: prev.count + 1 });
      }
    });

    // Sort months descending (newest first)
    const sorted = Array.from(monthMap.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, { label, count }]) => ({ key, label, count }));

    setToc(builtToc);
    setDateOptions(sorted);

    // Deep link: hash to post
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setSelectedId(id);
      }
    }
  }, [location.hash]);

  // Initialize date filter from URL (?month=YYYY-MM), if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get("month");
    if (m && m !== dateFilter) {
      setDateFilter(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Apply date filtering by showing/hiding <article> elements
  useEffect(() => {
    if (!containerRef.current) return;
    const articles = Array.from(containerRef.current.querySelectorAll("article"));
    articles.forEach((art) => {
      const artMonth = art.getAttribute("data-month"); // may be null if no parsable date
      if (!dateFilter || (artMonth && artMonth === dateFilter)) {
        art.style.display = ""; // show
      } else {
        art.style.display = "none"; // hide
      }
    });

    // keep URL in sync: ?month=YYYY-MM (or remove param if "All Dates")
    const params = new URLSearchParams(location.search);
    if (dateFilter) {
      params.set("month", dateFilter);
    } else {
      params.delete("month");
    }
    navigate({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
  }, [dateFilter, location.search, navigate]);

  // Styles
  const containerStyle = {
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
    color: "#222",
  };

  const topNav = { textAlign: "left", marginBottom: "20px" };

  const homeBtn = {
    background: "#BF5700",
    color: "white",
    padding: "8px 14px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: "bold",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    gap: "15px",
  };

  const logoStyle = { width: 60, height: 60, borderRadius: 8 };

  // Sticky toolbar for search + jump + date filter
  const toolbar = {
    position: "sticky",
    top: 8,
    zIndex: 10,
    background: "white",
    border: "1px solid #eee",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 24,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  };

  const toolbarRow = {
    display: "grid",
    gridTemplateColumns: "1fr 2fr auto",
    gap: 10,
    alignItems: "center",
  };

  const toolbarRow2 = {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: 10,
    alignItems: "center",
    marginTop: 10,
  };

  const labelStyle = { fontWeight: 600, color: "#555" };

  const selectStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    outline: "none",
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    outline: "none",
  };

  const goBtn = {
    background: "#BF5700",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const entryStyle = {
    borderBottom: "1px solid #ccc",
    paddingBottom: "20px",
    marginBottom: "20px",
    textAlign: "left",
  };

  const imgStyle = {
    maxWidth: "100%",
    height: "auto",
    marginTop: "10px",
    borderRadius: "8px",
    cursor: "zoom-in",
  };

  const actionsRow = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    flexWrap: "wrap",
  };

  const openBtn = {
    background: "#BF5700",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
  };

  const linkBtn = { color: "#BF5700", fontWeight: 600, textDecoration: "underline" };

  const modalOverlay = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  };

  const viewportStyle = {
    backgroundColor: "transparent",
    width: "95vw",
    height: "90vh",
    overflow: "auto",
    display: "block",
    borderRadius: 10,
    boxShadow: "0 0 15px rgba(0,0,0,0.5)",
  };

  const controls = {
    position: "fixed",
    top: 16,
    right: 16,
    display: "flex",
    gap: 8,
    zIndex: 1001,
  };

  const btn = {
    background: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 10px",
    fontWeight: "600",
    cursor: "pointer",
  };

  const closeBtn = { ...btn, background: "#ffefe8", color: "#BF5700" };

  // Handlers
  const stopOverlayClick = (e) => e.stopPropagation();

  // Image zoom handlers
  const handleWheelZoom = (e) => {
    if (!enlarged) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.05, Math.min(8, +(z + delta).toFixed(3))));
  };

  const setFit = () => {
    if (!enlarged || !viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const fitZ = Math.min(
      vw / enlarged.naturalWidth,
      vh / enlarged.naturalHeight,
      1
    );
    setZoom(+fitZ.toFixed(3));
  };

  const setHundred = () => setZoom(1); // 100% = pixel-perfect 1:1
  const zoomIn = () => setZoom((z) => Math.min(8, +(z + 0.25).toFixed(3)));
  const zoomOut = () => setZoom((z) => Math.max(0.05, +(z - 0.25).toFixed(3)));

  const openImage = (src) => {
    const img = new Image();
    img.onload = () => {
      setEnlarged({
        src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    };
    img.src = src;
  };

  const openPdf = (src) => setPdfSrc(src);

  // Dropdown behavior
  const filteredToc = toc.filter((t) =>
    t.title.toLowerCase().includes(titleFilter.toLowerCase())
  );

  const jumpTo = (id) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setSelectedId(id);
      // Update hash (deep-link)
      navigate(`#${id}`, { replace: true });
    }
  };

  return (
    <div style={containerStyle} ref={containerRef}>
      {/* 🔝 Return to Home at the very top */}
      <div style={topNav}>
        <Link to="/" style={homeBtn}>
          ⬅ Return to Home
        </Link>
      </div>

      {/* Header with Logo + Title */}
      <header style={headerStyle}>
        <img src={logo} alt="Longhorn Cards Logo" style={logoStyle} />
        <h1 style={{ color: "#BF5700" }}>Longhorn Cards and Collectibles Blog</h1>
      </header>

      {/* 🔎 Sticky controls: Title filter, Jump to, and Date filter */}
      <div style={toolbar} aria-label="Blog post navigator">
        {/* Row 1: Filter by title + (spacer) */}
        <div style={toolbarRow}>
          <label htmlFor="post-filter" style={labelStyle}>
            Filter posts (title)
          </label>
          <input
            id="post-filter"
            type="text"
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            placeholder="Type to filter by title…"
            style={inputStyle}
          />
          <span />
        </div>

        {/* Row 2: Jump to post */}
        <div style={{ ...toolbarRow, marginTop: 10 }}>
          <label htmlFor="post-select" style={labelStyle}>
            Jump to post
          </label>
          <select
            id="post-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={selectStyle}
          >
            <option value="">— Select a post —</option>
            {filteredToc.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button style={goBtn} onClick={() => jumpTo(selectedId)}>
            Go
          </button>
        </div>

        {/* Row 3: NEW — Filter by date (Month) */}
        <div style={toolbarRow2}>
          <label htmlFor="date-select" style={labelStyle}>
            Filter by date (month)
          </label>
          <select
            id="date-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All dates</option>
            {dateOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} {opt.count ? `(${opt.count})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------ YOUR POSTS BELOW (unchanged content) ------------------ */}

      {/* Blog Entry 29 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Victor Wembanyama Card Prices (August 2025)
        </h2>
        <p>
          “Wembamania” initially took the industry by storm, with many expecting a straight line up for prices indefinitely.  
          However, that has not been the case so far.
        </p>
        <p>
          Per Card Ladder, since 2023 card prices have fallen 82% from elevated levels, and over the past year prices are down 41%.
        </p>
        <p>
          Longhorn Cards and Collectibles has assigned Wemby a Composite Rank of 80, however, which is top quartile.  
          The Fundamental Rank and Sentiment Ranks are top quartile as well, at 80 and 83 respectively.  It’s the Technical Rank 
          of 22 that is of concern primarily, and overall Longhorn Cards and Collectibles has a Hold rating for Wemby at this time.
        </p>
        <p>
          Going forward, it does appear that most of the damage regarding falling prices is in the rear view.  In the second 
          part of 2025 we have begun to see a turn in prices with some stabilization.  As Wemby returns to prime playing condition, 
          it’s expected prices will recover as well.
        </p>
         <img
          src="/Wemby.png"
          alt="Wemby"
          style={imgStyle}
          onClick={() => openImage("/Wemby.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Wemby.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Wemby.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Wemby.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 28 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Digital Card Brands (August 2025)
        </h2>
        <p>
          This summary is a follow-up to the Digital Cards Explained blog post. 
        </p>
        <p>
          There are a variety of different brands of digital cards, and each have their own unique characteristics.
        </p>
        <p>
          It's important to decide what you want to purchase and then conduct due diligence on the most appropriate platform.
        </p>
         <img
          src="/DigitalBrands.png"
          alt="DigitalBrands"
          style={imgStyle}
          onClick={() => openImage("/DigitalBrands.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/DigitalBrands.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/DigitalBrands.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/DigitalBrands.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 27 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Digital Cards Explained (August 2025)
        </h2>
        <p>
          This summary seeks to help explain digital and "phygital" cards that are becoming more prevalent. 
        </p>
        <p>
          It's important to fully evaluate the key features and weigh the pros and cons before you decide to purchase.
        </p>
         <img
          src="/Digital.png"
          alt="Digital"
          style={imgStyle}
          onClick={() => openImage("/Digital.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Digital.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Digital.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Digital.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 26 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          New Highs (August 2025)
        </h2>
        <p>
          These select players are setting new all-time highs in terms of card prices. 
        </p>
        <p>
          Often when a new high is achieved it leads to subsequent additional new highs - momentum can be a powerful force 
          when there is no resistance. 
        </p>
        <p>
          These aren’t the only players setting new highs, but they are notable given their overall Composite ranks, 
          per Longhorn Cards and Collectibles.
        </p>
        <p>
          Michael Jordan has a 96 Composite Rank, Saquon Barkley has a 87 Composite Rank, Pete Crow-Armstrong has a 72 
          Composite Rank, and Jared Goff has a Composite Rank of 93.
        </p>
        <p>
          These above-average Composite Ranks combined with technical momentum in regard to new highs in card prices may 
          be a powerful combination as long as fundamentals remain intact.
        </p>
         <img
          src="/NewHighs.png"
          alt="NewHighs"
          style={imgStyle}
          onClick={() => openImage("/NewHighs.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/NewHighs.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/NewHighs.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/NewHighs.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 25 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Kevin Durant Card Prices (August 2025)
        </h2>
        <p>
          Kevin Durant is a 2x NBA Champion, 2x NBA Finals MVP, 13x NBA All-Star, and was NBA Rookie of the Year. In addition, he’s a 
          3x Olympic gold medalist.
        </p>
        <p>
          Per Card Ladder, Durant’s card prices are up 650% since 2007, and over the past year prices have increased 15%.
        </p>
        <p>
          Longhorn Cards and Collectibles gives Durant a Composite Rank of 81, Fundamental Rank of 81, Technical Rank of 54, and 
          Sentiment Rank of 89 - overall a Buy rating.
        </p>
        <p>
          Although the Technical Rating is around average, recently prices have started to move higher after finding long-term 
          support subsequent to the bear market after the Covid bubble.
        </p>
        <p>
          If prices are able to continue recovering towards levels achieved during the pandemic, it implies upside potential 
          of 500% from current levels.
        </p>
         <img
          src="/Durant.png"
          alt="Durant"
          style={imgStyle}
          onClick={() => openImage("/Durant.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Durant.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Durant.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Durant.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 24 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Joe Montana Card Prices (August 2025)
        </h2>
        <p>
          The 2021 Panini Prizm #FAJM Joe Montana /25 (Flashback Purple Power Auto) (PSA 8) is available for purchase at my eBay store.  Population 3 according to PSA with a total population of 9.
        </p>
        <p>
          Joe Montana is a 4 time Super Bowl champion and member of the Hall of Fame, with the nicknames “Cool Joe” and “The Comeback Kid.”
        </p>
        <p>
          According to Card Ladder, Montana’s card prices have increased over 1000% since they started tracking in 2004, and over the past year card prices are up 37%.
        </p>
        <p>
          Longhorn Cards and Collectibles assigns him a Composite Rank of 57, Fundamental Rank of 57, Technical Rank of 89, and Sentiment Rank of 29, with an overall Hold rating at this time.
        </p>
        <p>
          Going forward, given the strong technicals, card prices are poised to move higher and have recently broken out to the upside - just shy of the level reached during the pandemic.
        </p>
        <p>
          If card prices continue to have momentum, it would only take a 27% move higher to reach all-time highs, which may propel prices even further to the upside.
        </p>
         <img
          src="/Montana.png"
          alt="Montana"
          style={imgStyle}
          onClick={() => openImage("/Montana.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Montana.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Montana.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Montana.png" download>
            Download Image
          </a>
        </div>
      </article>      
      
      {/* Blog Entry 23 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Prewar Vintage Player Highlights (August 2025)
        </h2>
        <p>
          As mentioned in a previous post, the Card Ladder Prewar Vintage Index recently hit new all-time highs in terms of price.
        </p>
        <p>
          The Prewar Vintage index consists of cards released prior to 1945.
        </p>
        <p>
          Key players in this index include Babe Ruth, Lou Gehrig, Shoeless Joe Jackson, Ty Cobb, and many others.
        </p>
         <img
          src="/PrewarPlayers.png"
          alt="PrewarPlayers"
          style={imgStyle}
          onClick={() => openImage("/PrewarPlayers.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/PrewarPlayers.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/PrewarPlayers.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/PrewarPlayers.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 22 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Top 10 Composite Ranks (August 2025)
        </h2>
        <p>
          The Longhorn Cards & Collectibles ranking methodology is designed to identify sports cards with the highest probability of appreciation over the medium term.
        </p>
        <p>
          These proprietary calculations utilize historical card prices, player career statistics, and Google Trends data to reach an overall Composite Rank for each player.
        </p>
         <img
          src="/Top10.png"
          alt="Top10"
          style={imgStyle}
          onClick={() => openImage("/Top10.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Top10.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Top10.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Top10.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 21 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Wilt Chamberlain Card Prices (August 2025)
        </h2>
        <p>
          The 2008-09 Topps Chrome #178 Wilt Chamberlain /499 (Orange Refractor) (PSA 10) is available for sale in my eBay store.
        </p>
        <p>
          Wilt Chamberlain played 14 years in the NBA, and averaged 30 points and 23 rebounds per game.  He’s commonly included as 
          one of the best players of all time.
        </p>
        <p>
          Per Card Ladder, since they started tracking prices in 2004, Wilt’s cards have returned 1370%.  Over the past year, his card prices are up 13.4%.
        </p>
        <p>
          Longhorn Cards and Collectibles assigns Wilt an overall Composite Rank of 66, with a Fundamental Rank of 93, Technical Rank of 66, and Sentiment Rank of 13.  Currently Longhorn Cards and Collectibles has a Hold rating for Wilt.
        </p>
        <p>
          Based on current technicals, there appears to be light at the end of the tunnel post the pandemic bubble in card prices.  
          Like many others, Wilt’s cards have been working their way through a bear market.  Recently prices have turned up, however, 
          and look to be making their way towards previous highs.
        </p>
        <img
          src="/Wilt.png"
          alt="Wilt"
          style={imgStyle}
          onClick={() => openImage("/Wilt.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Wilt.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Wilt.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Wilt.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 20 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Aaron Rodgers Card Prices (August 2025)
        </h2>
        <p>
          The 2014 Bowman Chrome #21 Aaron Rodgers /50 (Gold Refractor) (PSA 10) is available for sale in my eBay store.  There are only 8 graded
          10 out of a PSA population of 15.
        </p>
        <p>
          Aaron Rodgers has been in the league for 20 years now - considering the average length in the NFL is around 3 years, that longevity is impressive.  It appears he’ll be finishing his career with the Steelers and hopefully leave on a good note.
        </p>
        <p>
          According to Card Ladder, Rodgers’ card prices have appreciated over 1500% since 2005, but they have declined over the past year.
        </p>
        <p>
          Longhorn Cards and Collectibles currently rates Rodgers as a Hold, with a Composite Rank of 68, Fundamental Rank of 68, Technical Rank of 29, and Sentiment Rank of 96.
        </p>
        <p>
          The high sentiment rank reflects his popularity and he garners a large fan base that should support market prices and liquidity.
        </p>
        <p>
          From a technical perspective, Rodgers’ card prices are sitting on long-term support, and appear poised to rebound higher.  Getting back to the COVID levels would imply an advance of over 350%.
        </p>
        <img
          src="/Rodgers.png"
          alt="Rodgers"
          style={imgStyle}
          onClick={() => openImage("/Rodgers.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Rodgers.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Rodgers.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Rodgers.png" download>
            Download Image
          </a>
        </div>
      </article>
      
      {/* Blog Entry 19 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Kobe Bryant Card Prices (August 2025)
        </h2>
        <p>
          This 2007 Topps Chrome #24 Kobe Bryant /999 (1957-58 Variation-Refractor) (PSA 9) is available for purchase at my eBay store.
          There are only 101 PSA 9’s with only 10 higher, according to PSA.
        </p>
        <p>
          Kobe Bryant recently made history again along with Michael Jordan as the most expensive sports card ever sold at $13M.
        </p>
        <p>
          According to Card Ladder, Kobe’s card prices have been soaring over the past year - up 44% - and since they started tracking prices in 2004, his cards have appreciated 2245%.
        </p>
        <p>
          Longhorn Cards and Collectibles has an overall Composite Rank of 87 for Kobe, which includes a Fundamental Rank of 68,
          Technical Rank of 87, and Sentiment Rank of 90 - this results in a Buy rating for his cards.
        </p>
        <p>
          As mentioned, card prices have been turning higher recently after entering a bear market post the pandemic.
        </p>
        <p>
          Going forward, with positive rankings and technical momentum, card prices appear poised to challenge the Covid highs over the medium/longer term - which implies over a 200% return from current levels.
        </p>
        <img
          src="/Kobe.png"
          alt="Kobe"
          style={imgStyle}
          onClick={() => openImage("/Kobe.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Kobe.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Kobe.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Kobe.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 18 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Prewar Vintage Index: New All-Time High (August 2025)
        </h2>
        <p>
          The Prewar Vintage Index of cards released prior to 1945 just hit an all-time high, surpassing the level reached
          during the Covid pandemic.
        </p>
        <p>
          Notable players in this era include Babe Ruth, Lou Gehrig, Honus Wagner, Cy Young, Ty Cobb, and Shoeless Joe Jackson.
        </p>
        <p>
          Since Card Ladder started tracking prices in 2004, the index has returned 560%. Over the past year, the index is up 18%.
        </p>
        <p>
          Sales volume metrics have been supportive of the move higher in card prices as well, with volumes surging in July and August 2025.
        </p>
        <img
          src="/PrewarIndex.png"
          alt="PrewarIndex"
          style={imgStyle}
          onClick={() => openImage("/PrewarIndex.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/PrewarIndex.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/PrewarIndex.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/PrewarIndex.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 1 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Scatterplot Overview (August 2025)</h2>
        <p>
          The Longhorn Cards and Collectibles proprietary scatterplot allows for the analysis of player Composite Rankings,
          Fundamental Rankings, Technical Rankings, and Sentiment Rankings.
        </p>
        <p>
          The plot area is color coded to better understand quadrants that include players with the strongest rankings, with green, blue,
          yellow, and red coloring.
        </p>
        <p>
          The key to understanding how to read the scatterplot is to know that higher ranking players, on average, should lead to
          stronger and more consistent card prices over time.
        </p>
        <p>
          For example, players in the green shaded area exhibit the highest current rankings, and many of these players are future
          hall-of-fame contenders with strong historical career statistics and are well known to the broad public.
        </p>
        <p>
          The scatterplot can be used to both evaluate current cards to purchase as well as which ones to avoid until their underlying
          rankings improve and offer more of a balance between risk and reward.
        </p>
        <img
          src="/Scatter.png"
          alt="Scatter"
          style={imgStyle}
          onClick={() => openImage("/Scatter.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Scatterplot.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Scatterplot.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Scatter.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 2 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Sentiment Rankings (August 2025)</h2>
        <p>
          Sentiment Rankings are based on Google Trends data, and the rankings provide a sense of how relevant and popular
          the respective players are versus other players.
        </p>
        <p>
          On average, players that are more popular will garner a larger fanbase, and that fanbase is more likely to purchase
          that player's sports cards as opposed to a player that is relatively unknown or even disliked.
        </p>
        <p>
          This measure of sentiment can be a critical factor as it makes the market for that player much larger, and should lead
          to stronger and more stable prices over time with a higher level of market liquidity.
        </p>
        <p>
          In this example, you can see how LeBron James has held a very high and consistent sentiment ranking, whereas Tyler Herro
          and Victor Wembanyama have been more volatile since they are younger players. Furthermore, "Shoeless" Joe Jackson has a
          relatively low sentiment ranking primarily because he's been deceased a long time and doesn't garner as much attention.
        </p>
        <p>
          Sentiment rankings are a critical part of our proprietary Composite Ranking in order to gauge the potential market for that
          player as well as the future price potential for their cards over the longer term.
        </p>
        <img
          src="/Sentiment.png"
          alt="Sentiment Rankings"
          style={imgStyle}
          onClick={() => openImage("/Sentiment.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Sentiment.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Sentiment.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Sentiment.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 3 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Understanding Rankings (August 2025)</h2>
        <p>
          Longhorn Cards and Collectibles calculates a number of different rankings that help gauge the overall strength and
          quality of a sports player for determining potential card price appreciation over the longer term.
        </p>
        <p>
          The Composite Rank is a combination of Technical Rank (based on historical card prices), Sentiment Rank (based on Google Trends),
          and Fundamental Rank (based on player's career statistics).
        </p>
        <p>
          The combination of these different rankings, along with changes to a players fundamentals (statistics), helps to
          determine if that card should be purchased.
        </p>
        <p>
          In addition, Fundamental Change is an important variable that compares the player's most recent season versus their historical
          average season to determine if they are outperforming, which should lead to robust card price returns.
        </p>
        <p>
          Overall, the rankings provide a quantitative way to evaulate players based on numerous criteria in order to determine if they
          are suitable for your collection.
        </p>
        <img
          src="/Rankings.png"
          alt="Rankings Overview"
          style={imgStyle}
          onClick={() => openImage("/Rankings.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Rankings.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Rankings.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Rankings.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 4 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Card Ladder Indexes (August 2025)</h2>
        <p>
          Over the past year, the Card Ladder CL50 Index is up approximately 23% and has returned 1400% since inception in 2004,
          which is a CAGR of around 14% per year.
        </p>
        <p>
          The Baseball and Basketball indexes are up 14% the past year, while Football is up 12%. The High-End market (+18%) is
          leading the Low-End market (+1.5%), while High population cards (+23%) are leading Low population cards (+11%).
        </p>
        <p>
          Overall, the sports card market continues to rebound from the bear market post the pandemic bubble.
        </p>
        <img
          src="/CL_Indexes.png"
          alt="Card Ladder Indexes"
          style={imgStyle}
          onClick={() => openImage("/CL_Indexes.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/CL_Indexes.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/CL_Indexes.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/CL_Indexes.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 5 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Babe Ruth Card Prices (August 2025)</h2>
        <p>
          According to Card Ladder data, Babe Ruth card prices have broken out convincingly from the bear market lows post the Covid bubble.
        </p>
        <p>
          Over the past 6- and 12-months, card prices are up 20% and 15%, respectively. This breakout has prices eyeing the Covid highs
          set in April 2022, which implies a 24% move from here.
        </p>
        <img
          src="/BabeRuth.png"
          alt="Babe Ruth time series"
          style={imgStyle}
          onClick={() => openImage("/BabeRuth.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/BabeRuth.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/BabeRuth.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/BabeRuth.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 6 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Geno Smith Card Prices (August 2025)</h2>
        <p>
          Geno Smith has executed on the field the past few years, with a breakout season last year. Last year's success resulted in
          Fundamental Change according to our calculation of 153% versus his career average, and as a result his card prices are up
          over 300% the past year.
        </p>
        <p>
          Since 2014, his cards have returned 1115% according to Card Ladder. Geno's cards look primed to continue advancing higher depending
          on his performance on the field this year with the Las Vegas Raiders.
        </p>
        <p>
          Longhorn Cards and Collectibles currently rates Geno as a Buy due to a Technical Rank of 100 and above-average Composite and Sentiment ranks.
          Fundamentals are improving with recent success, which should help support card prices going forward.
        </p>
        <img
          src="/Geno.png"
          alt="Geno Smith time series"
          style={imgStyle}
          onClick={() => openImage("/Geno.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Geno.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Geno.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Geno.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 7 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          History of Sports Trading Cards (August 2025)
        </h2>
        <p>Sports Trading Cards have a long and illustrious history that spans nearly two centuries.</p>
        <p>
          The global sports trading cards market size was valued at $14.9 billion in 2024 and is projected to reach $52.1 billion by 2034,
          growing at a CAGR of 13% from 2024 to 2034.
        </p>
        <p>Trading cards overall are still reboundinng from the massive increase in popularity during the pandemic.</p>
        <p>
          Since their humble beginning, sports cards have evolved from simple advertising tools to multi-million-dollar investments,
          but the present-day oversupply of “rare” cards due to artificial scarcity increases risks of entering a new “junk wax era”.
        </p>
        <p>Download and read the full History of Sports Trading Cards to dive deeper into the Hobby.</p>
        <img
          src="/History_of_Trading_Cards.png"
          alt="History of Trading Cards"
          style={imgStyle}
          onClick={() => openImage("/History_of_Trading_Cards.png")}
        />
        <div style={actionsRow}>
          <button
            style={openBtn}
            onClick={() => openPdf("/History_Of_Trading_Cards.pdf")}
          >
            View PDF
          </button>
          <a style={linkBtn} href="/History_Of_Trading_Cards.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/History_of_Trading_Cards.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 8 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          BGS vs. PSA GEM MINT Sales Comparison (August 2025)
        </h2>
        <p>Per ALT, there is a striking difference between BGS and PSA GEM MINT rated cards.</p>
        <p>The sales prices for PSA are often 2x-3x that of BGS for otherwise the same GEM MINT grade level.</p>
        <p>
          This is yet another example of PSA's dominance in the grading space, and how they can command a premium to other grading companies.
        </p>
        <img
          src="/BGSvsPSA.png"
          alt="BGS vs. PSA GEM MINT"
          style={imgStyle}
          onClick={() => openImage("/BGSvsPSA.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/BGSvsPSA.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/BGSvsPSA.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/BGSvsPSA.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 9 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          "Shoeless" Joe Jackson Card Prices (August 2025)
        </h2>
        <p>
          Over the past year, card prices for "Shoeless" Joe Jackson have soared 42% versus 18% for the Card Ladder Pre-War Vintage Index - which tracks cards released 1945 and earlier.
        </p>
        <p>
          Furthermore, "Shoeless" Joe Jackson's card prices have increased over 300% since Card Ladder began tracking data in 2008.
        </p>
        <p>In looking at the price history, it's been almost a straight line up with incredible momentum to the upside.</p>
        <p>
          For collectors, this type of price action is exactly what you want to see and it represents a rare opportunity for long-term appreciation.
        </p>
        <p>
          Longhorn Cards and Collectibles has above-average rankings for "Shoeless" Joe Jackson in terms of overall Composite Rank, Fundamental Rank, and Technical Rank.
        </p>
        <p>
          However, Sentiment Rank is in the bottom quartile compared to other players, and overall we rate the cards as a Hold for the meantime.
        </p>
        <img
          src="/Shoeless.png"
          alt="Shoeless Joe Jackson"
          style={imgStyle}
          onClick={() => openImage("/Shoeless.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Shoeless.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Shoeless.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Shoeless.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 10 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Sports Card Grading Companies (August 2025)
        </h2>
        <p>
          This is a list of sports card grading companies with their respective non-bulk minimum prices, estimated turnaround time, and maximum
          insured values.
        </p>
        <p>Per ChatGPT, top-tier grading companies are PSA, BGS, SGC, and CGC.</p>
        <p>Mid-tier grading companies are HGA, TAG, ISA, GMA, and MNT.</p>
        <p>Finally, low-tier grading companies include RCG, FCG, PGI, WCG, and the others listed and not listed.</p>
        <p>Despite the higher price, PSA has been shown to provide the highest value for their graded cards versus all other grading companies.</p>
        <p>
          However, there are exceptions of course because BGS, SGC, and CGC are top-tier companies similar to PSA.
        </p>
        <img
          src="/GradingCompaniesFinal.png"
          alt="Grading Companies Final"
          style={imgStyle}
          onClick={() => openImage("/GradingCompaniesFinal.png")}
        />
        <div style={actionsRow}>
          <button
            style={openBtn}
            onClick={() => openPdf("/GradingCompaniesFinal.pdf")}
          >
            View PDF
          </button>
          <a style={linkBtn} href="/GradingCompaniesFinal.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/GradingCompaniesFinal.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 11 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Top Sports Card Grading Companies (August 2025)
        </h2>
        <p>
          PSA, BGS, SGC, and CGC are the top-tier sports card grading companies according to ChatGPT and other online sources.
        </p>
        <p>
          This overview provides a summary for each company, detailed pricing, turnaround time information, and details about their process.
        </p>
        <p>
          Based on non-bulk pricing, currently BGS and SGC are tied for the cheapest minimum price per card, while SGC offers the most attractive turnaround time at base pricing.
        </p>
        <p>
          Each grading company provides a different value proposition as well as different encapsulations (slabs) that may be appealing to different people.
        </p>
        <p>
          PSA assigns grades based on different qualifiers using a process that is mostly objective, and their branded LightHouse
          Label provides full information including the grade and card details.
        </p>
        <p>
          BGS is especially renowned for grading newer cards, and assigns grades based on four subgrades: centering, corners, edges, and surface.
          They are known for their classy encapsulation design called the BGS Case Diagram.
        </p>
        <p>
          SGC has build a reputation for its focus on older, vintage cards - especially historic baseball trading cards and memorabilia. They are known
          for their straight-forward grading scale and fast turnaround times, with a distinctive tuxedo-like black matting within their encapsulation.
        </p>
        <p>
          CGC is a newer entrant to sports card grading and they are leveraging their expertise from grading comic books. They employ a team effort
          with advanced technology, and they stand out for their state-of-the-art encapsulation design.
        </p>
        <img
          src="/TopGradingCompaniesFinal.png"
          alt="Top Grading Companies Final"
          style={imgStyle}
          onClick={() => openImage("/TopGradingCompaniesFinal.png")}
        />
        <div style={actionsRow}>
          <button
            style={openBtn}
            onClick={() => openPdf("/TopGradingCompaniesFinal.pdf")}
          >
            View PDF
          </button>
          <a style={linkBtn} href="/TopGradingCompaniesFinal.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/TopGradingCompaniesFinal.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 12 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Most Expensive Card Sales of All-Time (August 2025)
        </h2>
        <p>
          According to Cllct, the nearly $13M purchase of the 2007-08 Upper Deck Exquisite Collection Michael Jordan and Kobe Bryant Dual Logoman set a new
          all-time high record for card sales, surpassing the $12.6M previous record for the 1952 Topps Mickey Mantle SGC 9.5.
        </p>
        <p>
          This $13M purchase also surpassed the previous record for a basketball card, which was $5.2M for the Exquisite Collection LeBron
          James Gold Rookie Patch Autograph /23.
        </p>
        <p>
          The new owners of the most expensive card are Kevin O'Leary (aka Mr. Wonderful) and his business partners Matt Allen and Paul Warshaw.
        </p>
        <img
          src="/AllTimeSales.png"
          alt="All Time Sales"
          style={imgStyle}
          onClick={() => openImage("/AllTimeSales.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/AllTimeSales.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/AllTimeSales.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/AllTimeSales.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 13 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Warren Buffett Autographed 1999 Shareholder Meeting Pass (August 2025)
        </h2>
        <p>
          This Berkshire Hathaway 1999 Annual Meeting pass is autographed by Warren Buffett and comes with a Letter of Authenticity.
          Please visit my eBay store to make an offer.
        </p>
        <p>
          This meeting occurred right in the middle of the Dot-com bubble, and Warren Buffett and Charlie Munger spent much of the meeting defending
          their decision not to invest in internet/technology companies.
        </p>
        <p>Per ChatGPT, during the meeting many shareholders pressed them on why Berkshire Hathaway was avoiding the "new economy".</p>
        <p>
          Warren Buffett reiterated his philosphy of only invesing in businesses he understood, while emphasizing durable
          competitive advantages, predictable cash flows, and reasonable valuations - all of which most technology companies during
          that time lacked as they did not have proven business models.
        </p>
        <p>During the meeting, Warren Buffett acknowledged all the excitement around the internet but warned about "speculative fever".</p>
        <p>
          A quote from Warren Buffett at a different time best reflects the sentiment of this meeting: "Buy into a company because
          you want to own it, not because you want the stock to go up."
        </p>
        <img
          src="/Buffett.png"
          alt="Buffett"
          style={imgStyle}
          onClick={() => openImage("/Buffett.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Buffett.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Buffett.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Buffett.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 14 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Drew Brees Card Prices (August 2025)
        </h2>
        <p>
          The 2001 Bowman's Best Drew Brees Certified Autograph PSA 9 Rookie Card is available for sale in my eBay store.
        </p>
        <p>
          Longhorn Cards and Collectibles' proprietary rankings show Drew Brees finished his career near the top decile in terms
          of Fundamental Rank.
        </p>
        <p>
          Overall, Brees has a Composite Rank of 60, Fundamental Rank of 89, Technical Rank of 60, and Sentiment Rank of 33 - which
          equates to a Hold rating according to Longhorn Cards and Collectibles.
        </p>
        <p>
          According to Card Ladder, since 2004 Brees' card prices have soard 10,311% and over the past year prices are up nearly 9%.
        </p>
        <p>
          Recently, Drew Brees' card prices have turned higher post the Covid bubble and subsequent bear market, which puts his cards
          in excellent shape to move higher over the longer term.
        </p>
        <img
          src="/Brees.png"
          alt="Drew Brees"
          style={imgStyle}
          onClick={() => openImage("/Brees.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Brees.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Brees.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Brees.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 15 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Card Daily Volume & Monthly Sales Count (August 2025)
        </h2>
        <p>
          Per Card Ladder, card daily volume represents the total amount of money spent on cards tracked in their sales history
          database each day.
        </p>
        <p>
          Monthly sales count is the total number of transactions tracked in Card Ladder's sales history database each month.
        </p>
        <p>
          In analyzing the chart patterns, it's clear there was a massive bubble during the pandemic, which resulted in a
          temporary surge in daily volume and an increase in the monthly sales count.
        </p>
        <p>
          However, the recent data shows that since the end of the pandemic, both daily volume and monthly sales count have increased
          well above the levels prior to the pandemic.
        </p>
        <p>
          This structural change in the marketplace has significant implications for market liquidity and overall transaction dynamics.
        </p>
        <p>
          In particular, the monthly sales count has almost gone parabolic - reflecting soaring transactions post the pandemic.
        </p>
        <p>
          Likewise, daily volume has continued to bubble higher and higher towards the levels experienced during the pandemic.
        </p>
        <p>
          The key takeaway from this data is that the sports card market has undergone a structural change towards higher volume and
          more transactions than prior to the pandemic, which should improve overall market efficiency.
        </p>
        <img
          src="/VolumeSales.png"
          alt="Volume and Sales"
          style={imgStyle}
          onClick={() => openImage("/VolumeSales.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/VolumeSales.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/VolumeSales.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/VolumeSales.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 16 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Shai Gilgeous-Alexander Card Prices (August 2025)
        </h2>
        <p>
          This 2022 Donruss Optic #44 Shai Gilgeous-Alexander /24 (Choice Blue Mojo) (PSA 10) is available for purchase in my eBay store.
        </p>
        <p>
          Shai Gilgeous-Alexander (SGA) is obviously a superior talent having won NBA and Finals MVP during the 2024-25 season, as well as a championship ring.
        </p>
        <p>
          According to Card Ladder, his card prices have grown 2810% since they began tracking in 2018, and over the past year prices have soared 188% -
          as has his popularity.
        </p>
        <p>
          Overall, Longhorn Cards and Collectibles assigns SGA a Composite Rank of 91, Fundamental Rank of 88, Technical Rank of 99, and Sentiment Rank of 90 - with a rating of Buy.
          Pretty much all metrics are top decile.
        </p>
        <p>
          The strong momentum in card prices is borderline parabolic, but given the underlying strength of his ranks it appears justified -
          more potential appreciation may be in store as the next season draws closer.
        </p>
        <img
          src="/SGA.png"
          alt="SGA"
          style={imgStyle}
          onClick={() => openImage("/SGA.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/SGA.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/SGA.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/SGA.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 17 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          Battle of the 9's (PSA vs. BGS vs. SGC vs. CGC) (August 2025)
        </h2>
        <p>
          The 2003-04 Topps 221 Lebron James Rookie Card was used to compare the top-tier grading companies using a grade of 9 for each company.
        </p>
        <p>
          The results show that PSA hands-down provided the highest sale value, followed by BGS, SGC, CGC, and finally ungraded (Raw).
        </p>
        <p>
          This analysis helps confirm that despite the higher cost and longer turnaround time, PSA may provide the best return on
          investment for grading cards.
        </p>
        <img
          src="/Battle.png"
          alt="Battle"
          style={imgStyle}
          onClick={() => openImage("/Battle.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/Battle.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/Battle.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/Battle.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Blog Entry 18 (second “18” in original) */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>
          PSA Grades (Comparison Down the Scale) (August 2025)
        </h2>
        <p>
          As Part 2 of the grading company analysis, this comparison looks at sale prices down the PSA scale from PSA 10 to PSA 5 for the 2003-04 Topps 221 LeBron James Rookie Card.
        </p>
        <p>PSA 10’s clearly command an advantage over PSA 9’s with a value more than double that of the 9’s.</p>
        <p>Likewise, PSA 9’s have over a 150% price advantage relative to PSA 8’s.</p>
        <p>Interestingly, the sale price of an ungraded raw card is on par with a PSA 8.</p>
        <p>
          As you move down the scale into PSA 7 through PSA 5, however, the price differences are much narrower, suggesting
          collectors should be crossing their fingers for anything PSA 8 or higher.
        </p>
        <p>
          The key takeaway is that grading a card can carry pricing risks - if the grade comes back less than a PSA 8,
          it may have been better to not grade the card at all.
        </p>
        <img
          src="/PSA.png"
          alt="PSA"
          style={imgStyle}
          onClick={() => openImage("/PSA.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/PSA.pdf")}>
            View PDF
          </button>
          <a style={linkBtn} href="/PSA.pdf" download>
            Download PDF
          </a>
          <a style={linkBtn} href="/PSA.png" download>
            Download Image
          </a>
        </div>
      </article>

      {/* Back to Home */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <Link to="/" style={{ color: "#BF5700", fontWeight: "bold" }}>
          ⬅ Back to Home
        </Link>
      </div>

      {/* IMAGE MODAL */}
      {enlarged && (
        <div
          style={modalOverlay}
          onClick={() => setEnlarged(null)}
          onWheel={handleWheelZoom}
        >
          <div style={controls} onClick={stopOverlayClick}>
            <button style={btn} onClick={zoomOut}>
              −
            </button>
            <button style={btn} onClick={zoomIn}>
              +
            </button>
            <button style={btn} onClick={setFit}>
              Fit
            </button>
            <button style={btn} onClick={setHundred}>
              100%
            </button>
            <button style={closeBtn} onClick={() => setEnlarged(null)}>
              Close
            </button>
          </div>

          <div
            ref={viewportRef}
            style={{ ...viewportStyle }}
            onClick={stopOverlayClick}
            title="Scroll to zoom, drag scrollbars to pan"
          >
            <div
              style={{
                minWidth: Math.max(enlarged.naturalWidth * zoom, 1),
                minHeight: Math.max(enlarged.naturalHeight * zoom, 1),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={enlarged.src}
                alt="Enlarged view"
                style={{
                  display: "block",
                  width: enlarged.naturalWidth * zoom,
                  height: enlarged.naturalHeight * zoom,
                  maxWidth: "none",
                  maxHeight: "none",
                  borderRadius: 10,
                  boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                  cursor: zoom > 0.99 ? "grab" : "zoom-out",
                  imageRendering: "auto",
                }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF MODAL */}
      {pdfSrc && (
        <div style={modalOverlay} onClick={() => setPdfSrc(null)}>
          <div style={controls} onClick={stopOverlayClick}>
            <a style={btn} href={pdfSrc} target="_blank" rel="noreferrer">
              Open in New Tab
            </a>
            <a style={btn} href={pdfSrc} download>
              Download
            </a>
            <button style={closeBtn} onClick={() => setPdfSrc(null)}>
              Close
            </button>
          </div>

          <div
            style={{ ...viewportStyle, overflow: "hidden" }}
            onClick={stopOverlayClick}
            title="Use the viewer toolbar to zoom/search; or open in a new tab."
          >
            <embed
              src={pdfSrc}
              type="application/pdf"
              width="100%"
              height="100%"
              style={{ borderRadius: 10, display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
