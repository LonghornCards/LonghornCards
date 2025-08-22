// src/HomePage.jsx
import React from "react";
import { Link } from "react-router-dom"; // ✅ import Link
import logo from "./assets/LogoSimple.jpg";
import ebayLogo from "./assets/eBay_Logo.png";

export default function HomePage() {
  const burntOrange = "#BF5700"; // Primary color
  const lightHighlight = "#FFF8F3"; // Subtle background tint

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

        {/* ✅ New Feeds link */}
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

        {/* ✅ New News link */}
        <Link
          to="/news"
          style={{
            textDecoration: "none",
            color: burntOrange,
            fontWeight: "bold",
            fontSize: "1.1rem",
          }}
        >
          News
        </Link>

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
      </nav>

      {/* Logo + Business Name */}
      <div style={{ marginBottom: "40px" }}>
        <img
          src={logo}
          alt="Longhorn Cards & Collectibles Logo"
          style={{
            width: "400px", // Increased size
            maxWidth: "90%", // Responsive on small screens
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
    </div>
  );
}
