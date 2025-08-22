// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage.jsx";
import Research from "./Research.jsx"; // <-- Research page
import History from "./History.jsx";   // <-- History page
import Feeds from "./Feeds.jsx";       // <-- Feeds page
import News from "./News.jsx";         // <-- ✅ New News page

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feeds" element={<Feeds />} />
        <Route path="/news" element={<News />} />   {/* ✅ News route */}
        <Route path="/research" element={<Research />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
