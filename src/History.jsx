// src/History.jsx
import React from "react";
import { Link } from "react-router-dom";
import logo from "./assets/LogoSimple.jpg"; // ✅ Make sure the file is here

export default function History() {
  const burntOrange = "#BF5700";

  // Shared button style (bigger bar)
  const btnBase = {
    textDecoration: "none",
    display: "inline-block",
    padding: "16px 28px", // bigger button
    borderRadius: 10,
    fontWeight: 800,
    fontSize: "1rem",
    border: `2px solid ${burntOrange}`,
    transition: "transform 0.08s ease, background-color 0.2s ease",
    cursor: "pointer",
  };

  const hover = (e) => (e.currentTarget.style.transform = "translateY(-1px)");
  const unhover = (e) => (e.currentTarget.style.transform = "none");

  const termStyle = {
    fontWeight: 700,
    color: "#111",
    marginTop: 16,
    marginBottom: 6,
  };

  const defStyle = {
    margin: 0,
    lineHeight: 1.6,
    color: "#333",
  };

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        color: "#222",
        backgroundColor: "#fff",
        minHeight: "100vh",
        padding: "32px 20px",
      }}
    >
      {/* Top bar with logo and Back to Home */}
      <header
        style={{
          maxWidth: 960,
          margin: "0 auto 32px",
          paddingBottom: 16,
          borderBottom: `3px solid ${burntOrange}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Logo on the left */}
        <img
          src={logo}
          alt="Longhorn Cards & Collectibles Logo"
          style={{
            width: "160px",
            height: "auto",
            objectFit: "contain",
          }}
        />

        <Link
          to="/"
          style={{
            ...btnBase,
            backgroundColor: "#f7f7f7",
            color: burntOrange,
          }}
          onMouseEnter={hover}
          onMouseLeave={unhover}
        >
          ← Back to Home
        </Link>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Title */}
        <h1
          style={{
            color: burntOrange,
            fontSize: "2rem",
            lineHeight: 1.2,
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          History of Sports Trading Cards
        </h1>

        {/* Double-spaced introduction */}
        <p style={{ fontSize: "1.15rem", lineHeight: 2 }}>
          <strong>Sports Trading Cards</strong> have a long and storied history
          that spans more than 150 years. The global sports trading cards market
          size was valued at <strong>$9.69 billion in 2022</strong> and is
          projected to reach <strong>$20.48 billion by 2030</strong>, growing at
          a <strong>CAGR of 9.01%</strong> from 2023 to 2030 (Grand View
          Research, 2023). Trading cards overall are still recovering from the
          unprecedented boom in popularity during the pandemic. Since their
          humble beginning, sports cards have evolved from simple advertising
          tools to multi-million-dollar investments, but the present-day
          overabundance of “rare” cards due to artificial scarcity increases
          risks of entering a new “junk wax era”. The following pages dive
          deeper into the history of sports trading cards.
        </p>

        {/* Bigger button bar BELOW the text */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <a
            href="/History_Of_Trading_Cards.pdf" // file in public/
            download
            style={{
              ...btnBase,
              backgroundColor: burntOrange,
              color: "#fff",
            }}
            onMouseEnter={(e) => {
              hover(e);
              e.currentTarget.style.backgroundColor = "#993F00";
            }}
            onMouseLeave={(e) => {
              unhover(e);
              e.currentTarget.style.backgroundColor = burntOrange;
            }}
          >
            ⬇ Download PDF
          </a>
        </div>

        {/* Glossary Section */}
        <section
          aria-labelledby="glossary-heading"
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: `3px solid ${burntOrange}`,
          }}
        >
          <h2
            id="glossary-heading"
            style={{
              color: burntOrange,
              fontSize: "1.6rem",
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            Sports Trading Card Glossary
          </h2>

          <div>
            <p style={termStyle}>1st Bowman</p>
            <p style={defStyle}>
              A player’s 1st Bowman card is their first professional baseball
              card, released before their official RC.
            </p>

            <p style={termStyle}>Acetate</p>
            <p style={defStyle}>
              A transparent plastic sometimes used in the making of cards rather
              than traditional paper card stock. While popular among many
              collectors, acetate cards have been known to suffer from
              discoloration over the years.
            </p>

            <p style={termStyle}>Altered</p>
            <p style={defStyle}>
              When a card has been changed from its original condition. Examples
              of alterations range from trimming edges and corners to recoloring
              faded pictures.
            </p>

            <p style={termStyle}>Authenticity Guarantee</p>
            <p style={defStyle}>
              A service provided by eBay where qualifying trading cards sold
              over a certain threshold are automatically shipped to CSG for
              authentication before being sent to the buyer.
            </p>

            <p style={termStyle}>Autograph</p>
            <p style={defStyle}>
              A card that is autographed by a player, celebrity, or other
              subject. Autos are a type of chase card – they are more limited,
              and thus more valuable, than the more common cards in a set.
            </p>

            <p style={termStyle}>Base Card</p>
            <p style={defStyle}>
              Base cards make up the base set, which is the most common set of
              cards in a sports or non-sport product.
            </p>

            <p style={termStyle}>Blaster Box</p>
            <p style={defStyle}>
              A type of retail box commonly distributed at large retail stores
              like Walmart and Target (as opposed to Hobby shops or online
              exclusives). Blaster boxes tend to have fewer packs per box
              (anywhere from 4 to 15) and, like other retail products, tend to
              have a lower price point, making them an accessible option for
              newcomers to The Hobby.
            </p>

            <p style={termStyle}>Book Card</p>
            <p style={defStyle}>
              When one or more cards – generally, autographed cards or relics –
              are combined to open like a book.
            </p>

            <p style={termStyle}>Box Loader</p>
            <p style={defStyle}>
              Also called toppers, these are special, single cards or sets of
              cards that are only available as inserts in hobby boxes. Box
              loaders are usually larger than standard-size cards and are meant
              as a unique opportunity for collectors to engage in the Hobby.
            </p>

            <p style={termStyle}>Breaking</p>
            <p style={defStyle}>
              The practice of opening multiple boxes or cases of a product at
              the same time, then distributing the cards to a larger group of
              paying customers. Breakers sell “slots,” and customers receive a
              defined portion of the opened product (e.g., by team or randomized
              allotment).
            </p>

            <p style={termStyle}>Card Sleeve</p>
            <p style={defStyle}>
              Plastic sleeves used to protect cards. The most popular kind –
              Penny Sleeves – get their name for being inexpensive: they cost a
              penny.
            </p>

            <p style={termStyle}>Card Stock</p>
            <p style={defStyle}>
              The type of paper or material used to produce trading cards. Card
              stock can vary in thickness, with thicker stock often used for
              higher-end products.
            </p>

            <p style={termStyle}>Case Hit</p>
            <p style={defStyle}>
              Certain products include a special card inserted “one per case.”
              These case hits are rarer and thus more valuable.
            </p>

            <p style={termStyle}>Cello Pack</p>
            <p style={defStyle}>
              A retail format where packs are wrapped in cellophane-like
              plastic. Cello boxes typically contain 24 packs and are often hung
              for single purchase. Pronounced “sello.”
            </p>

            <p style={termStyle}>Centering</p>
            <p style={defStyle}>
              One of the major categories used in grading. Borders commonly
              help determine centering, though logos and lettering can be used
              for full-bleed cards.
            </p>

            <p style={termStyle}>Chase Card</p>
            <p style={defStyle}>
              Highly coveted, limited cards within a set, such as autographs,
              rare parallels, rare rookies, relics, and certain inserts.
            </p>

            <p style={termStyle}>Chasing the Rainbow</p>
            <p style={defStyle}>
              Collecting different color parallel cards of a player.
            </p>

            <p style={termStyle}>Checklist</p>
            <p style={defStyle}>
              A list of every card in a product: base, parallels, autographs,
              etc.
            </p>

            <p style={termStyle}>Combination Card</p>
            <p style={defStyle}>
              Cards featuring two or more players/teams/elements on one card
              (e.g., dual/triple autos or relics).
            </p>

            <p style={termStyle}>Commemorative</p>
            <p style={defStyle}>
              A collectible created to acknowledge a historic event, record,
              anniversary, or other special occasion.
            </p>

            <p style={termStyle}>Completist</p>
            <p style={defStyle}>
              A collector driven to possess every card of a given set, year,
              team, player, or category—including all parallels and autos.
            </p>

            <p style={termStyle}>Die-cut</p>
            <p style={defStyle}>
              A card with portions of stock removed to create a shape, design,
              or function. Typically used as inserts and usually short-printed.
            </p>

            <p style={termStyle}>Error Card</p>
            <p style={defStyle}>
              A card containing a mistake (misspellings, wrong stats, incorrect
              photos, etc.), often leading to a recognized variation (VAR).
            </p>

            <p style={termStyle}>Event-Worn</p>
            <p style={defStyle}>
              Memorabilia worn by a player at a non-specific game or event (e.g.
              a rookie signing session).
            </p>

            <p style={termStyle}>Factory Set</p>
            <p style={defStyle}>
              A product configuration where a full set is packaged and sold in a
              single box, instead of random packs in hobby/retail boxes.
            </p>

            <p style={termStyle}>Facsimile Signature</p>
            <p style={defStyle}>
              An autograph applied via stamp or printing process; a replica
              signature not personally signed on-card by the subject.
            </p>

            <p style={termStyle}>Foil</p>
            <p style={defStyle}>
              A metallic texture applied to cards to enhance design. Often
              condition-sensitive (e.g., 1993 SP Foil Jeter).
            </p>

            <p style={termStyle}>Game-Used</p>
            <p style={defStyle}>
              Memorabilia used in an official game (bats, jerseys, gloves,
              bases, etc.).
            </p>

            <p style={termStyle}>Game-Worn</p>
            <p style={defStyle}>
              Memorabilia worn in an official game and embedded in a card;
              commonly appears on relic cards.
            </p>

            <p style={termStyle}>Gem Mint</p>
            <p style={defStyle}>
              A top condition rating such as PSA 10, BGS 9.5, SGC 10, or CSG 10.
            </p>

            <p style={termStyle}>Graded Card</p>
            <p style={defStyle}>
              A card authenticated and evaluated by a grading service (PSA, BGS,
              SGC, CSG).
            </p>

            <p style={termStyle}>Hanger Pack</p>
            <p style={defStyle}>
              A retail format that hangs. Modern hanger boxes typically contain
              a single pack.
            </p>

            <p style={termStyle}>Hit</p>
            <p style={defStyle}>
              A modern term for higher-value chase cards (autographs, relics,
              inserts, coveted rookies).
            </p>

            <p style={termStyle}>Hobby Box</p>
            <p style={defStyle}>
              Higher-end boxes with more chase content, typically distributed
              via hobby shops or online—distinct from retail boxes.
            </p>

            <p style={termStyle}>Hobby-Exclusive</p>
            <p style={defStyle}>
              Products or content (e.g., parallels/inserts) that appear only in
              hobby formats (e.g., National Treasures, Flawless).
            </p>

            <p style={termStyle}>Insert Card</p>
            <p style={defStyle}>
              Non-base, non-parallel cards with their own themes, designs,
              names, and numbering.
            </p>

            <p style={termStyle}>Jersey Card</p>
            <p style={defStyle}>
              A card containing a small piece (“swatch”) of a player’s jersey.
              Swatches are typically single-color mesh/cloth, unlike multi-color
              patch pieces.
            </p>

            <p style={termStyle}>Numbered</p>
            <p style={defStyle}>
              Short-printed cards with the print run specified on the front or
              back.
            </p>

            <p style={termStyle}>One of One (1/1)</p>
            <p style={defStyle}>
              The rarest type of trading card—only one exists for that specific
              version.
            </p>

            <p style={termStyle}>One-Touch</p>
            <p style={defStyle}>
              A magnetic holder used to protect mid/high-end raw cards; often
              preferred over toploaders for display.
            </p>

            <p style={termStyle}>Parallel</p>
            <p style={defStyle}>
              Versions of base cards with distinct physical traits (colors,
              patterns, finishes) that “run parallel” to the base set and are
              typically more limited.
            </p>

            <p style={termStyle}>Patch Card</p>
            <p style={defStyle}>
              Cards featuring a multi-color jersey patch embedded in the card.
              Patches can be game-used, but not always.
            </p>

            <p style={termStyle}>Player Collector</p>
            <p style={defStyle}>
              A collector who focuses on one player (analogous to a team
              collector focusing on a single team).
            </p>

            <p style={termStyle}>Pop Report</p>
            <p style={defStyle}>
              A published census from a grading company showing how many of a
              specific card received each grade.
            </p>

            <p style={termStyle}>Printing Plate</p>
            <p style={defStyle}>
              The thin metal plate used to print cards—usually in cyan, magenta,
              yellow, and black. Often offered as one-of-one collectibles.
            </p>

            <p style={termStyle}>Print Run</p>
            <p style={defStyle}>
              The total number of copies produced for a specific card (ranges
              from 1/1 to mass-produced).
            </p>

            <p style={termStyle}>Prospecting</p>
            <p style={defStyle}>
              Collecting cards of young players who haven’t reached the MLB yet,
              aiming to acquire potential future stars early.
            </p>

            <p style={termStyle}>Raw</p>
            <p style={defStyle}>
              A card that has not been graded/slabbed by a third party (e.g.,
              PSA, BGS). Pack-pulled cards are raw until submitted and graded.
            </p>

            <p style={termStyle}>Razz</p>
            <p style={defStyle}>
              A raffle/lottery involving cards (e.g., 10 spots at $10 each, one
              random winner receives the card).
            </p>

            <p style={termStyle}>Redemption Card</p>
            <p style={defStyle}>
              A card that can be exchanged (“redeemed”) with the manufacturer to
              receive a hit (typically an autograph) at a later date.
            </p>

            <p style={termStyle}>Refractor</p>
            <p style={defStyle}>
              Cards that refract light to create prism/rainbow-like effects.
              Many products include multiple named refractor variations.
            </p>

            <p style={termStyle}>Relic Card</p>
            <p style={defStyle}>
              A card with a piece of memorabilia embedded in it (e.g., jersey
              swatch, game-used baseball).
            </p>

            <p style={termStyle}>Reprint</p>
            <p style={defStyle}>
              A reproduction of a previously printed card. Listings marked “RP”
              indicate a reprint—not the original.
            </p>

            <p style={termStyle}>Retail Box</p>
            <p style={defStyle}>
              Lower-priced boxes widely distributed in big-box retailers. Same
              base set as hobby but fewer guaranteed hits/chases.
            </p>

            <p style={termStyle}>Retail-Exclusive</p>
            <p style={defStyle}>
              Cards (inserts/parallels) that appear only in retail formats (e.g.
              Blaster-only inserts, Hanger-only parallels).
            </p>

            <p style={termStyle}>Rookie Card (RC)</p>
            <p style={defStyle}>
              A player’s first card issued after their Major League debut,
              usually designated with an “RC” that same year (or sometimes the
              following year).
            </p>

            <p style={termStyle}>RPA (Rookie Patch Autograph)</p>
            <p style={defStyle}>
              A rookie card featuring both a patch and an autograph; typically
              among the most desirable/expensive cards in a set.
            </p>

            <p style={termStyle}>Scarce</p>
            <p style={defStyle}>
              A subjective term for limited availability. In vintage contexts,
              “scarce” is easier to obtain than “rare.” The term is often used
              loosely in modern hype.
            </p>

            <p style={termStyle}>Short Print (SP) / Super Short Print (SSP)</p>
            <p style={defStyle}>
              Cards printed in lower quantities than others in the set. SSPs are
              even rarer; pack odds indicate scarcity (under ~50 is often
              considered SSP).
            </p>

            <p style={termStyle}>Sketch Card</p>
            <p style={defStyle}>
              One-of-one, hand-drawn cards created by a licensed artist for a
              set, typically signed by the artist.
            </p>

            <p style={termStyle}>Slabbing</p>
            <p style={defStyle}>
              Synonym for grading. A slabbed card is one encased by a grading
              service. (“You should get it slabbed.”)
            </p>

            <p style={termStyle}>Superfractor</p>
            <p style={defStyle}>
              The rarest refractor type—short-printed 1/1—making it one of the
              most desired cards in any product.
            </p>

            <p style={termStyle}>Team Collector</p>
            <p style={defStyle}>
              A collector who focuses on a single team (analogous to a player
              collector).
            </p>

            <p style={termStyle}>Toploader</p>
            <p style={defStyle}>
              A thick plastic case used (with a penny sleeve) to protect and
              store valuable cards.
            </p>

            <p style={termStyle}>Variation</p>
            <p style={defStyle}>
              A card intentionally designed to differ from its common
              counterparts (e.g., different background, corrected error,
              misspelled name, photo variation).
            </p>

            <p style={termStyle}>Vintage</p>
            <p style={defStyle}>
              A subjective term for older cards. A common modern cutoff is 1980
              and earlier.
            </p>

            <p style={termStyle}>Wax</p>
            <p style={defStyle}>
              Hobby slang for unopened product (box/case). To “rip” or “break
              wax” is to open sealed product.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
