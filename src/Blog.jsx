// src/Blog.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import logo from "./assets/LogoSimple.jpg"; // ✅ import logo from src-assets

export default function Blog() {
  // Image modal state (pixel-accurate zoom)
  const [enlarged, setEnlarged] = useState(null); // { src, naturalWidth, naturalHeight }
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef(null);

  // PDF modal state
  const [pdfSrc, setPdfSrc] = useState(null);

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
    const fitZ = Math.min(vw / enlarged.naturalWidth, vh / enlarged.naturalHeight, 1);
    setZoom(fitZ > 0 ? +fitZ.toFixed(3) : 1);
    requestAnimationFrame(() => {
      const wrap = viewportRef.current?.firstChild;
      if (wrap) {
        viewportRef.current.scrollLeft = (wrap.scrollWidth - vw) / 2;
        viewportRef.current.scrollTop = (wrap.scrollHeight - vh) / 2;
      }
    });
  }, [enlarged]);

  // Styles
  const containerStyle = {
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
    color: "#222",
  };

  const topNav = {
    textAlign: "left",
    marginBottom: "20px",
  };

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
    marginBottom: "40px",
    gap: "15px",
  };

  const logoStyle = { width: 60, height: 60, borderRadius: 8 };

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

  const linkBtn = {
    color: "#BF5700",
    fontWeight: 600,
    textDecoration: "underline",
  };

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

  const closeBtn = {
    ...btn,
    background: "#ffefe8",
    color: "#BF5700",
  };

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
    const fitZ = Math.min(vw / enlarged.naturalWidth, vh / enlarged.naturalHeight, 1);
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

  return (
    <div style={containerStyle}>
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

      {/* Blog Entry 1 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Card Ladder Indexes</h2>
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

      {/* Blog Entry 2 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Babe Ruth Card Prices</h2>
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

      {/* Blog Entry 3 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>Geno Smith Card Prices</h2>
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

      {/* Blog Entry 4 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>History of Sports Trading Cards</h2>
        <p>
          Sports Trading Cards have a long and illustrious history that spans nearly two centuries. 
         </p>
         <p> 
          The global sports trading cards market size was valued at $14.9 billion in 2024 and is projected to reach $52.1 billion by 2034, 
          growing at a CAGR of 13% from 2024 to 2034.
        </p>
        <p>
          Trading cards overall are still reboundinng from the massive increase in popularity during the pandemic. 
         </p>
         <p> 
          Since their humble beginning, sports cards have evolved from simple advertising tools to multi-million-dollar investments, 
          but the present-day oversupply of “rare” cards due to artificial scarcity increases risks of entering a new “junk wax era”.
        </p>
        <p>
          Download and read the full History of Sports Trading Cards to dive deeper into the Hobby.
        </p>
        <img
          src="/History_of_Trading_Cards.png"
          alt="History of Trading Cards"
          style={imgStyle}
          onClick={() => openImage("/History_of_Trading_Cards.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/History_Of_Trading_Cards.pdf")}>
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
            <button style={btn} onClick={zoomOut}>−</button>
            <button style={btn} onClick={zoomIn}>+</button>
            <button style={btn} onClick={setFit}>Fit</button>
            <button style={btn} onClick={setHundred}>100%</button>
            <button style={closeBtn} onClick={() => setEnlarged(null)}>Close</button>
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
        <div
          style={modalOverlay}
          onClick={() => setPdfSrc(null)}
        >
          <div style={controls} onClick={stopOverlayClick}>
            <a style={btn} href={pdfSrc} target="_blank" rel="noreferrer">
              Open in New Tab
            </a>
            <a style={btn} href={pdfSrc} download>
              Download
            </a>
            <button style={closeBtn} onClick={() => setPdfSrc(null)}>Close</button>
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
