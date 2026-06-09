// =============================================================================
// HintGenerator.jsx
// CHANGE: No longer owns conversation state.
// Receives { conversation, setConversation } props from App.jsx instead.
// This means navigating away and back preserves the full hint feed.
// All visual code and CSS is identical — only state management changed.
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import '../design-system.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function generateSessionId(username) {
  return `${username}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent)', display: 'inline-block',
          animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

function HintBadge({ n, isAnswer }) {
  if (isAnswer) return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--success)', background: 'var(--success-dim)',
      border: '1px solid rgba(61,214,140,0.2)',
      borderRadius: 99, padding: '2px 8px', letterSpacing: '0.05em',
    }}>ANSWER</span>
  );
  const labels = ['HINT 01', 'HINT 02', 'HINT 03'];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--accent)', background: 'var(--accent-dim)',
      border: '1px solid rgba(232,197,71,0.2)',
      borderRadius: 99, padding: '2px 8px', letterSpacing: '0.05em',
    }}>{labels[n - 1] || `HINT ${n}`}</span>
  );
}

function RatingRow({ hintId, currentRating, onRate }) {
  if (currentRating !== null && currentRating !== undefined) {
    return (
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 12 }}>
        {currentRating === 1 ? '↑ marked helpful' : '↓ marked unhelpful'}
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Was this helpful?</span>
      <button className="s-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }}
        onClick={() => onRate(hintId, 1)}>↑ Yes</button>
      <button className="s-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }}
        onClick={() => onRate(hintId, 0)}>↓ No</button>
    </div>
  );
}

function HintCard({ hint, index, onRate }) {
  return (
    <div className="hint-card-outer animate-fadeUp" style={{ animationDelay: `${index * 0.05}s` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <HintBadge n={index + 1} />
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
      <p className="hint-body">{hint.text}</p>
      <RatingRow hintId={hint.hint_id} currentRating={hint.rating}
        onRate={(id, r) => onRate(id, r, false)} />
    </div>
  );
}

function AnswerCard({ text, hintId, rating, onRate }) {
  return (
    <div className="answer-card-outer animate-fadeUp">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <HintBadge isAnswer />
        <div style={{ flex: 1, height: 1, background: 'rgba(61,214,140,0.15)' }} />
      </div>
      <p className="hint-body">{text}</p>
      <RatingRow hintId={hintId} currentRating={rating}
        onRate={(id, r) => onRate(id, r, true)} />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// Props:
//   user, setUser        — auth (same as before)
//   conversation         — { question, code, hints, showDirectOption,
//                            directAnswer, directHintId, directRating }
//   setConversation      — { setQuestion, setCode, setHints, ... }
//
// WHY THIS PATTERN:
// Instead of this component owning state with useState(), it reads state
// from props and updates it via setter functions from props.
// The state lives in App.jsx which never unmounts, so it survives navigation.
// =============================================================================
export default function HintGenerator({ user, setUser, conversation, setConversation }) {

  // Destructure the conversation state from props
  const {
    question, code, hints, showDirectOption,
    directAnswer, directHintId, directRating,
  } = conversation;

  // Destructure the setters from props
  const {
    setQuestion, setCode, setHints, setShowDirectOption,
    setDirectAnswer, setDirectHintId, setDirectRating,
  } = setConversation;

  // These three stay LOCAL — they don't need to survive navigation
  // loading: spinner state — fine to reset when you come back
  // error: error message — fine to reset
  // showCode: code panel toggle — fine to reset
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showCode, setShowCode] = useState(false);

  // sessionIdRef stays local too — it's a useRef not useState,
  // so React doesn't track it for rendering. We initialize it once
  // and it persists as long as this component is mounted.
  // When a new question is typed, the useEffect below regenerates it.
  const sessionIdRef = useRef(generateSessionId(user?.username || 'user'));
  const feedEndRef   = useRef(null);
  const navigate     = useNavigate();

  useEffect(() => { if (!user) navigate('/'); }, [user, navigate]);

  // When question changes → reset the conversation for this new question
  // NOTE: This useEffect still watches `question` from props, not local state.
  // It correctly resets hints when the user types a NEW question.
  // But crucially, it does NOT run just because you navigated away and back —
  // the question value in App.jsx didn't change, so this effect doesn't fire.
  const prevQuestionRef = useRef(question);
  useEffect(() => {
    // Only reset if question actually changed (not on first mount with existing question)
    if (prevQuestionRef.current !== question && prevQuestionRef.current !== '') {
      setHints([]);
      setShowDirectOption(false);
      setDirectAnswer(null);
      setDirectHintId(null);
      setDirectRating(null);
      setError('');
      sessionIdRef.current = generateSessionId(user?.username || 'user');
    }
    prevQuestionRef.current = question;
  }, [question]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom of feed when new hint arrives
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [hints, directAnswer, loading]);

  const submitRating = async (hintId, rating, isDirect = false) => {
    try {
      const res = await fetch(`${API_URL}/api/rate_hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ hint_id: hintId, rating }),
      });
      if (res.status === 401) { setUser(null); navigate('/'); return; }
      if (res.ok) {
        if (isDirect) { setDirectRating(rating); }
        else { setHints(prev => prev.map(h => h.hint_id === hintId ? { ...h, rating } : h)); }
      }
    } catch (e) { console.error('rating failed', e); }
  };

  const getHint = async (wantDirectAnswer = false) => {
    try {
      setLoading(true); setError('');
      const res = await fetch(`${API_URL}/api/get_hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({
          question, code_context: code,
          hint_number: hints.length + 1,
          want_direct_answer: wantDirectAnswer,
          session_id: sessionIdRef.current,
        }),
      });
      if (res.status === 401) { setUser(null); navigate('/'); return; }
      if (res.status === 429) { const d = await res.json(); setError(d.error || 'Rate limited.'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get hint');
      if (wantDirectAnswer) {
        setDirectAnswer(data.hint);
        setDirectHintId(data.hint_id);
      } else {
        setHints(prev => [...prev, { text: data.hint, hint_id: data.hint_id, rating: null }]);
        if (hints.length + 1 >= 3) setShowDirectOption(true);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const isEmpty = hints.length === 0 && !directAnswer && !loading;

  return (
    <>
      <style>{`
        .app-shell { display: flex; height: 100vh; overflow: hidden; position: relative; z-index: 1; }
        .sidebar { width: 240px; flex-shrink: 0; border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; background: var(--bg-base); }
        .sidebar-top { padding: 20px 20px 16px; border-bottom: 1px solid var(--border-subtle); }
        .sidebar-nav { flex: 1; padding: 12px 10px; overflow-y: auto; }
        .nav-item { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: var(--radius-sm); font-size: 13px; color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); border: 1px solid transparent; margin-bottom: 2px; }
        .nav-item:hover { background: var(--bg-elevated); color: var(--text-primary); }
        .nav-item.active { background: var(--accent-muted); color: var(--accent); border-color: rgba(232,197,71,0.15); }
        .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
        .sidebar-bottom { padding: 12px 10px; border-top: 1px solid var(--border-subtle); }
        .user-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--bg-elevated); margin-bottom: 8px; }
        .user-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--accent-dim); border: 1px solid rgba(232,197,71,0.3); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px; color: var(--accent); flex-shrink: 0; font-weight: 500; }
        .user-name { font-size: 13px; color: var(--text-primary); font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 768px) { .sidebar { display: none; } }
        .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); }
        .topbar { display: none; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); }
        @media (max-width: 768px) { .topbar { display: flex; } }
        .feed { flex: 1; overflow-y: auto; padding: 0 0 40px; display: flex; flex-direction: column; }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; animation: fadeIn 0.5s ease both; }
        .empty-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-dim); border: 1px solid rgba(232,197,71,0.2); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
        .empty-title { font-size: 17px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; letter-spacing: -0.02em; }
        .empty-sub { font-size: 13px; color: var(--text-tertiary); max-width: 280px; line-height: 1.7; }
        .feed-inner { padding: 24px 32px; max-width: 760px; width: 100%; margin: 0 auto; }
        @media (max-width: 600px) { .feed-inner { padding: 16px; } }
        .hint-card-outer { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px 22px; margin-bottom: 12px; transition: border-color var(--transition-base); }
        .hint-card-outer:hover { border-color: var(--border-default); }
        .answer-card-outer { background: var(--bg-surface); border: 1px solid rgba(61,214,140,0.15); border-radius: var(--radius-lg); padding: 20px 22px; margin-bottom: 12px; }
        .hint-body { font-size: 14px; line-height: 1.75; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word; }
        .thinking-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px 22px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
        .thinking-label { font-size: 13px; color: var(--text-tertiary); }
        .direct-btn-row { display: flex; justify-content: center; padding: 8px 0 4px; margin-bottom: 12px; }
        .error-bar { background: var(--error-dim); border: 1px solid rgba(248,113,113,0.2); border-radius: var(--radius-md); padding: 10px 14px; font-size: 13px; color: var(--error); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .input-dock { border-top: 1px solid var(--border-subtle); padding: 16px 32px 20px; background: var(--bg-base); }
        @media (max-width: 600px) { .input-dock { padding: 12px 16px 16px; } }
        .dock-inner { max-width: 760px; margin: 0 auto; }
        .dock-box { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); overflow: hidden; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
        .dock-box:focus-within { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(255,255,255,0.03); }
        .dock-question { width: 100%; background: transparent; border: none; outline: none; font-family: var(--font-sans); font-size: 14px; color: var(--text-primary); line-height: 1.6; padding: 14px 16px 8px; resize: none; min-height: 52px; max-height: 160px; }
        .dock-question::placeholder { color: var(--text-tertiary); }
        .dock-code-area { border-top: 1px solid var(--border-subtle); overflow: hidden; max-height: 0; transition: max-height 0.3s ease; }
        .dock-code-area.open { max-height: 220px; }
        .dock-code { width: 100%; background: transparent; border: none; outline: none; font-family: var(--font-mono); font-size: 12px; line-height: 1.7; color: var(--text-secondary); padding: 10px 16px; resize: none; min-height: 100px; max-height: 200px; }
        .dock-code::placeholder { color: var(--text-tertiary); font-family: var(--font-sans); }
        .dock-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-top: 1px solid var(--border-subtle); }
        .dock-tools { display: flex; align-items: center; gap: 4px; }
        .dock-tool-btn { display: flex; align-items: center; gap: 5px; background: transparent; border: none; font-family: var(--font-sans); font-size: 12px; color: var(--text-tertiary); cursor: pointer; padding: 4px 8px; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
        .dock-tool-btn:hover { color: var(--text-secondary); background: var(--bg-elevated); }
        .dock-tool-btn.active { color: var(--accent); }
        .char-count { font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono); }
        .send-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--accent); border: none; cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; font-size: 14px; }
        .send-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 3px 10px rgba(232,197,71,0.3); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .dock-hint { font-size: 11px; color: var(--text-tertiary); text-align: center; margin-top: 8px; }
      `}</style>

      <div className="app-shell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-top"><Logo size="md" /></div>
          <nav className="sidebar-nav">
            <div className="nav-item active">
              <span className="nav-icon">◈</span> Ask a question
            </div>
            <div className="nav-item" onClick={() => navigate('/metrics')}>
              <span className="nav-icon">◻</span> My stats
            </div>
          </nav>
          <div className="sidebar-bottom">
            <div className="user-row">
              <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
              <span className="user-name">{user?.username}</span>
            </div>
            <button className="s-btn-danger" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setUser(null); navigate('/'); }}>
              Sign out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main-area">

          {/* Mobile topbar */}
          <div className="topbar">
            <Logo size="sm" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="s-btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}
                onClick={() => navigate('/metrics')}>Stats</button>
              <button className="s-btn-danger" style={{ padding: '5px 10px' }}
                onClick={() => { setUser(null); navigate('/'); }}>Out</button>
            </div>
          </div>

          {/* Feed */}
          <div className="feed">
            {isEmpty ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <h2 className="empty-title">What are you stuck on?</h2>
                <p className="empty-sub">
                  Describe your problem below. You'll get up to 3 progressive hints,
                  each one going a little deeper.
                </p>
              </div>
            ) : (
              <div className="feed-inner">
                {error && <div className="error-bar"><span>⚠</span>{error}</div>}
                {hints.map((h, i) => (
                  <HintCard key={h.hint_id || i} hint={h} index={i} onRate={submitRating} />
                ))}
                {loading && (
                  <div className="thinking-card">
                    <ThinkingDots />
                    <span className="thinking-label">Thinking…</span>
                  </div>
                )}
                {showDirectOption && !directAnswer && !loading && (
                  <div className="direct-btn-row">
                    <button className="s-btn-ghost" style={{ fontSize: 13, padding: '8px 18px' }}
                      onClick={() => getHint(true)}>
                      Show me the answer →
                    </button>
                  </div>
                )}
                {directAnswer && (
                  <AnswerCard text={directAnswer} hintId={directHintId}
                    rating={directRating} onRate={submitRating} />
                )}
                <div ref={feedEndRef} />
              </div>
            )}
          </div>

          {/* Input Dock */}
          <div className="input-dock">
            <div className="dock-inner">
              {error && isEmpty && (
                <div className="error-bar" style={{ marginBottom: 10 }}><span>⚠</span>{error}</div>
              )}
              <div className="dock-box">
                <textarea
                  className="dock-question"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Describe your coding problem or question…"
                  maxLength={2000}
                  rows={2}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && question.trim() && !loading)
                      getHint(false);
                  }}
                />
                <div className={`dock-code-area ${showCode ? 'open' : ''}`}>
                  <textarea
                    className="dock-code"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="// Paste your code here (optional)"
                    maxLength={10000}
                    rows={5}
                  />
                </div>
                <div className="dock-toolbar">
                  <div className="dock-tools">
                    <button
                      className={`dock-tool-btn ${showCode ? 'active' : ''}`}
                      onClick={() => setShowCode(v => !v)}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{'{}'}</span>
                      Code
                    </button>
                    {question && <span className="char-count">{question.length}/2000</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>⌘↵ to send</span>
                    <button
                      className="send-btn"
                      disabled={!question.trim() || loading}
                      onClick={() => getHint(false)}
                    >↑</button>
                  </div>
                </div>
              </div>
              {hints.length > 0 && !showDirectOption && (
                <p className="dock-hint">
                  Hint {hints.length} of 3 — {3 - hints.length} more available
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}