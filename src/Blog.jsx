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
            and Victor Wembanyama have been more volatile since they are younger players.  Furthermore, "Shoeless" Joe Jackson has a 
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
        <h2 style={{ color: "#BF5700" }}>History of Sports Trading Cards (August 2025)</h2>
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

      {/* Blog Entry 8 */}
      <article style={entryStyle}>
        <h2 style={{ color: "#BF5700" }}>BGS vs. PSA GEM MINT Sales Comparison (August 2025)</h2>
        <p>
          Per ALT, there is a striking difference between BGS and PSA GEM MINT rated cards. 
         </p>
         <p> 
          The sales prices for PSA are often 2x-3x that of BGS for otherwise the same GEM MINT grade level.
        </p>
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
        <h2 style={{ color: "#BF5700" }}>"Shoeless" Joe Jackson Card Prices (August 2025)</h2>
        <p>
          Over the past year, card prices for "Shoeless" Joe Jackson have soared 42% versus 18% for the Card Ladder Pre-War Vintage Index - which tracks cards released 1945 and earlier.
         </p>
         <p> 
          Furthermore, "Shoeless" Joe Jackson's card prices have increased over 300% since Card Ladder began tracking data in 2008.
        </p>
        <p>
          In looking at the price history, it's been almost a straight line up with incredible momentum to the upside.
         </p>
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
        <h2 style={{ color: "#BF5700" }}>Sports Card Grading Companies (August 2025)</h2>
        <p>
          This is a list of sports card grading companies with their respective non-bulk minimum prices, estimated turnaround time, and maximum 
          insured values.
         </p>
         <p> 
          Per ChatGPT, top-tier grading companies are PSA, BGS, SGC, and CGC.
        </p>
        <p>
          Mid-tier grading companies are HGA, TAG, ISA, GMA, and MNT.
         </p>
         <p>
            Finally, low-tier grading companies include RCG, FCG, PGI, WCG, and the others listed and not listed.
         </p>
         <p>
            Despite the higher price, PSA has been shown to provide the highest value for their graded cards versus all other grading companies.
         </p>
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
          <button style={openBtn} onClick={() => openPdf("/GradingCompaniesFinal.pdf")}>
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
        <h2 style={{ color: "#BF5700" }}>Top Sports Card Grading Companies (August 2025)</h2>
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
            BGS is especially renowned for grading newer cards, and assigns grades based on four subgrades:  centering, corners, edges, and surface.
            They are known for their classy encapsulation design called the BGS Case Diagram.
         </p>
         <p>
          SGC has build a reputation for its focus on older, vintage cards - especially historic baseball trading cards and memorabilia.  They are known 
          for their straight-forward grading scale and fast turnaround times, with a distinctive tuxedo-like black matting within their encapsulation.
         </p>
         <p>
          CGC is a newer entrant to sports card grading and they are leveraging their expertise from grading comic books.  They employ a team effort 
          with advanced technology, and they stand out for their state-of-the-art encapsulation design.
         </p>
         <img
          src="/TopGradingCompaniesFinal.png"
          alt="Top Grading Companies Final"
          style={imgStyle}
          onClick={() => openImage("/TopGradingCompaniesFinal.png")}
        />
        <div style={actionsRow}>
          <button style={openBtn} onClick={() => openPdf("/TopGradingCompaniesFinal.pdf")}>
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
        <h2 style={{ color: "#BF5700" }}>Most Expensive Card Sales of All-Time (August 2025)</h2>
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
        <h2 style={{ color: "#BF5700" }}>Warren Buffett Autographed 1999 Shareholder Meeting Pass (August 2025)</h2>
        <p>
          This Berkshire Hathaway 1999 Annual Meeting pass is autographed by Warren Buffett and comes with a Letter  of Authenticity.  
          Please visit my eBay store to make an offer.  
         </p>
         <p> 
          This meeting occurred right in the middle of the Dot-com bubble, and Warren Buffett and Charlie Munger spent much of the meeting defending 
          their decision not to invest in internet/technology companies.
        </p>
        <p>
          Per ChatGPT, during the meeting many shareholders pressed them on why Berkshire Hathaway was avoiding the "new economy".
         </p>
         <p>
          Warren Buffett reiterated his philosphy of only invesing in businesses he understood, while emphasizing durable 
          competitive advantages, predictable cash flows, and reasonable valuations - all of which most technology companies during 
          that time lacked as they did not have proven business models.
         </p>
         <p>
          During the meeting, Warren Buffett acknowledged all the excitement around the internet but warned about "speculative fever".
         </p>
         <p>
          A quote from Warren Buffett at a different time best reflects the sentiment of this meeting:  "Buy into a company because 
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
        <h2 style={{ color: "#BF5700" }}>Drew Brees Card Prices (August 2025)</h2>
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
