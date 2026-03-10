// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage.jsx";
import History from "./History.jsx";         // <-- History page
import Feeds from "./Feeds.jsx";             // <-- Feeds page
import GradingCompanies from "./GradingCompanies.jsx"; // <-- ✅ New page

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feeds" element={<Feeds />} />
        {/* 🚫 News route removed */}
        <Route path="/history" element={<History />} />
        <Route path="/grading-companies" element={<GradingCompanies />} /> {/* ✅ New route */}
      </Routes>
    </Router>
  );
}
