// =============================================================================
// App.jsx — Auth persistence via localStorage
// =============================================================================
//
// FIX #1: USER LOGGED OUT ON REFRESH
//
// BEFORE: user state lived only in React RAM.
//         RAM is wiped on every page refresh → user logged out.
//
// AFTER:  On login, we save { username, token } to localStorage.
//         On app load (useEffect with []), we read localStorage back.
//         If a valid token is found → user is automatically restored.
//         On logout → localStorage is cleared.
//
// WHY localStorage AND NOT sessionStorage?
// sessionStorage clears when the TAB is closed.
// localStorage persists until explicitly cleared — survives refresh AND
// closing/reopening the browser. This matches what users expect.
//
// SECURITY NOTE:
// localStorage is vulnerable to XSS attacks (malicious scripts can read it).
// The production-grade solution is httpOnly cookies (JS cannot access them).
// For this project, localStorage is the correct pragmatic choice and
// is used by many real apps (GitHub, Linear etc).
// Mention this trade-off in interviews — it shows security awareness.

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login            from './pages/Login';
import SignUp           from './pages/SignUp';
import HintGenerator    from './pages/HintGenerator';
import MetricsDashboard from './pages/MetricsDashboard';
import Profile          from './pages/Profile';
import './design-system.css';

// Keys used in localStorage — constants prevent typos
const STORAGE_KEY_USER = 'symbi_user';

export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  // Initialize from localStorage if available.
  // () => {...} is a lazy initializer — runs only once on mount, not on every render.
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      // JSON.parse can throw if localStorage has corrupt data
      return null;
    }
  });

  // ── Conversation state (survives navigation) ───────────────────────────────
  const [question,         setQuestion]         = useState('');
  const [code,             setCode]             = useState('');
  const [hints,            setHints]            = useState([]);
  const [showDirectOption, setShowDirectOption] = useState(false);
  const [directAnswer,     setDirectAnswer]     = useState(null);
  const [directHintId,     setDirectHintId]     = useState(null);
  const [directRating,     setDirectRating]     = useState(null);

  // ── Persist user to localStorage whenever it changes ──────────────────────
  // This useEffect runs every time `user` changes.
  // If user is set → save to localStorage.
  // If user is null (logout) → remove from localStorage.
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  const handleSetUser = (newUser) => {
    setUser(newUser);
    if (!newUser) {
      // Clear conversation on logout so next user starts fresh
      setQuestion(''); setCode(''); setHints([]);
      setShowDirectOption(false); setDirectAnswer(null);
      setDirectHintId(null); setDirectRating(null);
    }
  };

  const conversation    = { question, code, hints, showDirectOption, directAnswer, directHintId, directRating };
  const setConversation = { setQuestion, setCode, setHints, setShowDirectOption, setDirectAnswer, setDirectHintId, setDirectRating };

  return (
    <Router>
      <Routes>
        <Route path="/"        element={<Login    setUser={handleSetUser} />} />
        <Route path="/signup"  element={<SignUp   setUser={handleSetUser} />} />
        <Route path="/hint"    element={user ? <HintGenerator    user={user} setUser={handleSetUser} conversation={conversation} setConversation={setConversation} /> : <Navigate to="/" replace />} />
        <Route path="/metrics" element={user ? <MetricsDashboard user={user} setUser={handleSetUser} /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={user ? <Profile          user={user} setUser={handleSetUser} /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}