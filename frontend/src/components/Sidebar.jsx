// =============================================================================
// Sidebar.jsx — Shared sidebar component
// Used by HintGenerator, MetricsDashboard, and Profile.
// Shows navigation + recent session history (like ChatGPT's sidebar)
// =============================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Sidebar({ user, setUser, onSelectSession }) {
  const [recentSessions, setRecentSessions] = useState([]);
  const navigate  = useNavigate();
  const location  = useLocation();

  // Load recent sessions for history display
  useEffect(() => {
    if (!user?.token) return;
    fetch(`${API_URL}/api/metrics`, {
      headers: { 'Authorization': `Bearer ${user.token}` }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.recent_sessions) setRecentSessions(data.recent_sessions);
    })
    .catch(() => {});
  }, [user]);

  const navItems = [
    { label: 'Ask a question', icon: '◈', path: '/hint' },
    { label: 'My stats',       icon: '◻', path: '/metrics' },
    { label: 'Profile',        icon: '○', path: '/profile' },
  ];

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Logo size="md" />
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px' }}>
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <div key={item.path} onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, marginBottom: 2, cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                color:      active ? 'var(--accent)'      : 'var(--text-secondary)',
                background: active ? 'var(--accent-muted)': 'transparent',
                border:     active ? '1px solid rgba(232,197,71,0.15)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
            >
              <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </nav>

      {/* Recent sessions history — like ChatGPT sidebar */}
      {recentSessions.length > 0 && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <p style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-tertiary)',
            padding: '12px 20px 6px',
          }}>Recent</p>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px' }}>
            {recentSessions.map((s, i) => (
              <div key={i}
                onClick={() => onSelectSession?.(s)}
                style={{
                  padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', marginBottom: 2,
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <p style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', lineHeight: 1.4,
                }}>{s.question}</p>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {s.total_hints} hint{s.total_hints !== 1 ? 's' : ''} · {s.got_direct_answer ? 'answered' : 'hints only'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User row + sign out */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)', marginBottom: 8,
          cursor: 'pointer',
        }} onClick={() => navigate('/profile')}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '1px solid rgba(232,197,71,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', flexShrink: 0,
          }}>{user?.username?.[0]?.toUpperCase()}</div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.username}
          </span>
        </div>
        <button className="s-btn-danger" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => { setUser(null); navigate('/'); }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}