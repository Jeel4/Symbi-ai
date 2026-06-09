// =============================================================================
// App.jsx — Conversation state lifted here so it survives page navigation
// =============================================================================
//
// WHY THIS FIXES THE PROBLEM:
//
// Before: conversation state lived INSIDE HintGenerator component.
// React destroys a component's state when you navigate away from it.
// Going to /metrics unmounts HintGenerator → all useState values are lost.
//
// After: conversation state lives HERE in App.jsx.
// App.jsx is NEVER unmounted — it's the root of the entire app.
// HintGenerator just receives state as props and calls setter functions.
// Navigating to /metrics doesn't touch App.jsx state at all.
//
// This is exactly how Claude and ChatGPT work:
// The sidebar/conversation state is held at the root level, outside the
// chat view, so browsing to settings or history doesn't erase your thread.
//
// STATE THAT MUST PERSIST:
//   question        — the current question text in the input
//   code            — the current code text in the input
//   hints           — all AI hint cards in the feed
//   directAnswer    — the final direct answer if unlocked
//   directHintId    — hint_id for the direct answer (for ratings)
//   directRating    — user's rating on the direct answer
//   showDirectOption — whether the "Show answer" button is visible
//   sessionIdRef    — session UUID (useRef, doesn't need lifting — kept in HintGenerator)
//
// STATE THAT STAYS LOCAL (doesn't need to survive navigation):
//   loading         — spinner state, fine to reset
//   error           — error message, fine to reset
//   showCode        — whether code panel is open, fine to reset

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login            from './pages/Login';
import SignUp           from './pages/SignUp';
import HintGenerator    from './pages/HintGenerator';
import MetricsDashboard from './pages/MetricsDashboard';
import './design-system.css';

export default function App() {
  // ── Auth state ──────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  // ── Conversation state (persists across navigation) ─────────────────────
  // These are the values that were previously inside HintGenerator's useState.
  // By moving them here, they survive unmounting of HintGenerator.

  const [question, setQuestion]                 = useState('');
  const [code, setCode]                         = useState('');
  const [hints, setHints]                       = useState([]);          // [{ text, hint_id, rating }]
  const [showDirectOption, setShowDirectOption] = useState(false);
  const [directAnswer, setDirectAnswer]         = useState(null);
  const [directHintId, setDirectHintId]         = useState(null);
  const [directRating, setDirectRating]         = useState(null);

  // Bundle all conversation state into one object so HintGenerator
  // receives a clean, single prop for state and a single prop for setters.
  // This avoids passing 14 individual props.
  const conversation = {
    question, code, hints, showDirectOption,
    directAnswer, directHintId, directRating,
  };

  const setConversation = {
    setQuestion, setCode, setHints, setShowDirectOption,
    setDirectAnswer, setDirectHintId, setDirectRating,
  };

  // Called when the user logs out — clears conversation too so the
  // next user doesn't see the previous user's questions.
  const handleSetUser = (newUser) => {
    setUser(newUser);
    if (!newUser) {
      // Reset conversation on logout
      setQuestion(''); setCode(''); setHints([]);
      setShowDirectOption(false); setDirectAnswer(null);
      setDirectHintId(null); setDirectRating(null);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/"       element={<Login setUser={handleSetUser} />} />
        <Route path="/signup" element={<SignUp setUser={handleSetUser} />} />

        <Route path="/hint"
          element={user
            ? <HintGenerator
                user={user}
                setUser={handleSetUser}
                conversation={conversation}
                setConversation={setConversation}
              />
            : <Navigate to="/" replace />}
        />

        <Route path="/metrics"
          element={user
            ? <MetricsDashboard user={user} setUser={handleSetUser} />
            : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}