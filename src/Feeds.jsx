// src/Feeds.jsx
// A vertically stacked feed wall that tries to embed each URL in an <iframe>.
// Note: Many modern sites (news/blogs/pod hosts) set X-Frame-Options or CSP
// headers that block embedding. When that happens, the card includes an
// "Open" button to view the content in a new tab.

import React from "react";

const SOURCES = [
  // Spotify shows (embedded) — titles fetched previously
  { label: "Sports Cards Nonsense", url: "https://open.spotify.com/show/7wNc6wHkCViK3OcuLJG7mj?si=bHn7-yzTSfy8SRamIwY3uA" },
  { label: "Sports Card Investor", url: "https://open.spotify.com/show/3DDfEsKDIDrTlnPOiG4ZF4?si=aKIZ4iC7RliWE7AbVga-eg" },
  { label: "Sports Card Strategy Show", url: "https://open.spotify.com/show/4jbdUs62GK9ekON7vaxqz8?si=3G9i_DRjQauNn6DTA6OZuQ" },
  { label: "Sports Cards Live", url: "https://open.spotify.com/show/3iMRU41zxzhRF1SYkDqyET?si=nQsrNGU2T9KBRPuxCC8WDw" },
  { label: "Sports Card Nation Podcast", url: "https://open.spotify.com/show/0wbBkz4tQhT2wEjdUbFck1?si=E4hAw2AnRHmW4CtILTOg-g" },
  { label: "Geoff Wilson Show", url: "https://open.spotify.com/show/19cthTVIfykIAQej3FW3j9?si=1-DzbbcBQ5OhCsB8grah1g" },
  { label: "SlabStox Sports Card Trading", url: "https://open.spotify.com/show/4UIahi5DX98Oi3cu9rOAgO?si=NRscn2p-S2eCed4pB6IKSg" },
  { label: "Card Talk", url: "https://open.spotify.com/show/6mvFfYu8mskoRggljcpe5f?si=dJdo9f40TQiUC6hPSbfkEw" },
  { label: "The True Sports Cards Show", url: "https://open.spotify.com/show/38050UAnhnni0YQjINlQdO?si=PnjW7xyjS3K1pYPN3k2_Kg" },
  { label: "Cards To The Moon", url: "https://open.spotify.com/show/7cRwSepRkdaHsnFvhXOBmF?si=BoQe5VWRRNi9qN8yzyJ-WQ" },
  { label: "Sports Card Lessons Podcast", url: "https://open.spotify.com/show/295SzYQUu19Uk4JjtTjonx?si=_owrz5tQSCC698_Mg6G3ZQ" },
  { label: "Sports Card Madness", url: "https://open.spotify.com/show/48hzXpdyJqKsCpDJeHfBC7?si=e-xwIQiAS0a1OpFIdLWLGA" },
  { label: "Welcome to Stacking Slabs", url: "https://open.spotify.com/episode/5RuCjXb1E3osmAGaMuWF5M?si=f55Pa-6-Te6jmYFGoeKutA" },

  // YouTube videos (moved to bottom)
  { label: "THE BEST NATIONAL SPORTS CARD SHOW EVER (2025)", url: "https://youtu.be/V4h4qOV4as0?si=j7kamEeQAAy_oQzt" },
  { label: "10 Levels Of Sports Cards", url: "https://youtu.be/JPV6-cXBof0?si=9Pwv_MkoETae7mUC" },
  { label: "The BRUTAL TRUTHS of Reselling Sports Cards", url: "https://youtu.be/xBvtI1EyFT0?si=6bqWPqeEI3QMw23N" },
  { label: "Can You Make Money Buying Retail Sports Cards?", url: "https://youtu.be/r0lhscS2TPI?si=KfWDKH14fk0q0ZB5" },
  { label: "Sports Card Content isn't Dead... It's Just Lazy", url: "https://youtu.be/rs9qZKGX2PU?si=Yh_KOZhpmvM3Z3gP" },
  { label: "MC Mondays Showcase: High-End Sports Card Auction...", url: "https://www.youtube.com/live/_T2HCB2XZoU?si=sf55BFdl1A7fPR_U" },
];

function getEmbedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    // Spotify show/episode embeds
    if (host.includes("spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const kind = parts[0]; // 'show' or 'episode' etc.
      const id = parts[1];
      if (kind === "show" && id) return `https://open.spotify.com/embed/show/${id}`;
      if (kind === "episode" && id) return `https://open.spotify.com/embed/episode/${id}`;
      return url; // fallback
    }

    // youtu.be short links
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (host.includes("youtube.com")) {
      // /watch?v=VIDEO
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        return v ? `https://www.youtube.com/embed/${v}` : url;
      }
      // /live/VIDEOID
      if (u.pathname.startsWith("/live/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      return url;
    }

    return url;
  } catch (e) {
    return url;
  }
}

function getSuggestedHeight(url) {
  if (url.includes("open.spotify.com/show")) return 232;
  if (url.includes("open.spotify.com/episode")) return 152;
  if (url.includes("youtube.com/@") || url.includes("podbean.com") || url.includes("wethehobby.com") || url.includes("feeds.transistor.fm") || url.includes("spreaker.com")) {
    return 600;
  }
  return 400;
}

export default function Feeds() {
  const styles = {
    page: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "24px 16px 80px",
      background: "#faf7f3",
      minHeight: "100vh",
      boxSizing: "border-box",
    },
    title: {
      fontSize: 32,
      fontWeight: 800,
      margin: "4px 0 8px",
      color: "#cd853f", // Peru
      letterSpacing: 0.4,
    },
    subtitle: {
      fontSize: 14,
      color: "#5a4634",
      marginBottom: 20,
    },
    card: {
      background: "#fff",
      border: "1px solid #e7d7c9",
      borderRadius: 16,
      boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      overflow: "hidden",
      margin: "16px 0",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      background: "#f4ede6",
      borderBottom: "1px solid #ead9c7",
    },
    headerText: {
      fontWeight: 700,
      color: "#4a3728",
      fontSize: 16,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      paddingRight: 8,
    },
    openLink: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #cd853f",
      color: "#cd853f",
      background: "transparent",
      textDecoration: "none",
      fontSize: 13,
      fontWeight: 700,
    },
    iframe: {
      width: "100%",
      border: 0,
      display: "block",
    },
    navRow: {
      display: "flex",
      justifyContent: "flex-start",
      margin: "0 0 12px",
    },
    homeLink: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid #cd853f",
      color: "#fff",
      background: "#cd853f",
      textDecoration: "none",
      fontSize: 14,
      fontWeight: 700,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.navRow}><a href="/" style={styles.homeLink}>← Home</a></div>
      <h1 style={styles.title}>Feeds</h1>
      <p style={styles.subtitle}>
        Sports trading card feeds that provide timely insights about the hobby; use the
        <strong> Open</strong> button if a card appears blank.
      </p>

      {SOURCES.map((item, i) => {
        const embedSrc = item.rawIframe ? null : getEmbedUrl(item.url);
        const height = getSuggestedHeight(item.url);
        return (
          <section key={i} style={styles.card}>
            <div style={styles.header}>
              <div style={styles.headerText}>{item.label}</div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={styles.openLink}>
                Open ↗
              </a>
            </div>
            {item.rawIframe ? (
              <div dangerouslySetInnerHTML={{ __html: item.rawIframe }} />
            ) : (
              <iframe
                title={`${item.label} (embedded)`}
                src={embedSrc}
                height={height}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                style={styles.iframe}
              />
            )}
          </section>
        );
      })}
      <div style={styles.navRow}><a href="/" style={styles.homeLink}>← Home</a></div>
    </div>
  );
}
