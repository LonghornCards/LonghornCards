// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage.jsx";
import Research from "./Research.jsx"; // <-- Research page
import History from "./History.jsx";   // <-- History page

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/research" element={<Research />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
