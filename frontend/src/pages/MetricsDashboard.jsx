// =============================================================================
// MetricsDashboard.jsx — Redesigned
// Matches the sidebar layout of HintGenerator exactly.
// All data fetching and logic identical to previous version.
// =============================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import '../design-system.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// A single KPI card
function KpiCard({ value, label, sub, accent }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${accent ? 'rgba(232,197,71,0.15)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      transition: 'border-color var(--transition-base)',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = accent ? 'rgba(232,197,71,0.15)' : 'var(--border-subtle)'}
    >
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500,
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
        letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6,
      }}>{value}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// Minimal horizontal bar
function Bar({ label, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{count}</span>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 2, height: 3 }}>
        <div style={{
          background: 'var(--accent)', borderRadius: 2, height: 3,
          width: `${pct}%`, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

// Session row in the table
function SessionRow({ s, i }) {
  const date = new Date(s.started_at * 1000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      gap: 16, alignItems: 'center',
      padding: '11px 0',
      borderBottom: '1px solid var(--border-subtle)',
      animation: `fadeUp 0.3s ease ${i * 0.05}s both`,
    }}>
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{s.question}</p>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
      }}>{s.total_hints} hint{s.total_hints !== 1 ? 's' : ''}</span>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
        color: s.got_direct_answer ? 'var(--warning)' : 'var(--success)',
      }}>{s.got_direct_answer ? 'got answer' : 'solved'}</span>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
        {dateStr} {time}
      </span>
    </div>
  );
}

export default function MetricsDashboard({ user, setUser }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    fetchMetrics();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMetrics = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/metrics`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.status === 401) { setUser(null); navigate('/'); return; }
      if (!res.ok) throw new Error('Failed to load metrics');
      setMetrics(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        .metrics-shell {
          display: flex; height: 100vh; overflow: hidden;
          position: relative; z-index: 1;
        }
        .metrics-sidebar {
          width: 240px; flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          display: flex; flex-direction: column;
          background: var(--bg-base);
        }
        @media (max-width: 768px) { .metrics-sidebar { display: none; } }
        .metrics-main {
          flex: 1; overflow-y: auto;
          padding: 36px 40px;
        }
        @media (max-width: 600px) { .metrics-main { padding: 20px 16px; } }
        .metrics-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 32px;
        }
        .metrics-title {
          font-size: 20px; font-weight: 600; color: var(--text-primary);
          letter-spacing: -0.02em; margin-bottom: 4px;
        }
        .metrics-sub { font-size: 13px; color: var(--text-tertiary); }
        .section-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--text-tertiary);
          margin-bottom: 14px; margin-top: 28px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }
        .section-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 20px 22px;
        }
        .interpretation {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          margin-top: 28px;
        }
        .interp-row {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 12px; color: var(--text-tertiary);
          line-height: 1.6; margin-bottom: 8px;
        }
        .interp-row:last-child { margin-bottom: 0; }
        .interp-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent); flex-shrink: 0; margin-top: 6px;
        }
        .loading-area {
          display: flex; align-items: center; justify-content: center;
          height: 100%; gap: 10px;
          font-size: 13px; color: var(--text-tertiary);
        }
        @keyframes spin2 { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid var(--border-default);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin2 0.8s linear infinite;
        }
        .empty-metrics {
          text-align: center; padding: 60px 20px;
          color: var(--text-tertiary); font-size: 14px;
        }
      `}</style>

      <div className="metrics-shell">

        {/* Sidebar */}
        <aside className="metrics-sidebar">
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Logo size="md" />
          </div>
          <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
            <div
              className="nav-item"
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
                borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)',
                cursor: 'pointer', marginBottom: 2,
                transition: 'all var(--transition-fast)',
              }}
              onClick={() => navigate('/hint')}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <span style={{ width: 18, textAlign: 'center' }}>◈</span> Ask a question
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
              borderRadius: 'var(--radius-sm)', fontSize: 13,
              color: 'var(--accent)', background: 'var(--accent-muted)',
              border: '1px solid rgba(232,197,71,0.15)', marginBottom: 2,
            }}>
              <span style={{ width: 18, textAlign: 'center' }}>◻</span> My stats
            </div>
          </nav>
          <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)', marginBottom: 8,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--accent-dim)', border: '1px solid rgba(232,197,71,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)',
              }}>{user?.username?.[0]?.toUpperCase()}</div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user?.username}</span>
            </div>
            <button className="s-btn-danger" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setUser(null); navigate('/'); }}>Sign out</button>
          </div>
        </aside>

        {/* Main */}
        <div className="metrics-main">
          {loading && (
            <div className="loading-area">
              <div className="spinner" />
              <span>Loading metrics…</span>
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: 'var(--error-dim)', border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px',
              fontSize: 13, color: 'var(--error)',
            }}>{error}</div>
          )}

          {metrics && !loading && (
            <>
              <div className="metrics-header">
                <div>
                  <h1 className="metrics-title">Learning analytics</h1>
                  <p className="metrics-sub">How well the AI is guiding you.</p>
                </div>
                <button className="s-btn-ghost" onClick={fetchMetrics} style={{ fontSize: 12 }}>
                  Refresh
                </button>
              </div>

              {/* KPI grid */}
              <p className="section-label">Overview</p>
              <div className="kpi-grid">
                <KpiCard
                  value={metrics.summary.helpfulness_rate_pct + '%'}
                  label="Helpfulness rate"
                  sub={`${metrics.summary.total_ratings} ratings`}
                  accent
                />
                <KpiCard
                  value={metrics.summary.avg_hints_per_session}
                  label="Avg hints / session"
                  sub="Lower is better"
                />
                <KpiCard
                  value={metrics.summary.direct_answer_rate_pct + '%'}
                  label="Direct answer rate"
                  sub="% skipped hints"
                />
                <KpiCard
                  value={metrics.summary.avg_ai_response_ms + 'ms'}
                  label="AI response time"
                  sub="Avg latency"
                />
                <KpiCard
                  value={metrics.summary.total_sessions}
                  label="Total sessions"
                  sub="Questions asked"
                />
                <KpiCard
                  value={metrics.summary.total_hints_generated}
                  label="Hints generated"
                  sub="AI responses"
                />
              </div>

              {/* Hint distribution */}
              {Object.keys(metrics.hint_distribution).length > 0 && (
                <>
                  <p className="section-label">Hint distribution</p>
                  <div className="section-card">
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                      Which hint levels students reach most often.
                    </p>
                    {(() => {
                      const labels = { '1': 'Hint 1 — Conceptual', '2': 'Hint 2 — Strategic', '3': 'Hint 3 — Implementation', '4': 'Direct answer' };
                      const max = Math.max(...Object.values(metrics.hint_distribution));
                      return Object.entries(metrics.hint_distribution).map(([n, c]) => (
                        <Bar key={n} label={labels[n] || `Hint ${n}`} count={c} max={max} />
                      ));
                    })()}
                  </div>
                </>
              )}

              {/* Recent sessions */}
              {metrics.recent_sessions.length > 0 && (
                <>
                  <p className="section-label">Recent sessions</p>
                  <div className="section-card" style={{ padding: '4px 22px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                      gap: 16, padding: '10px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      {['Question', 'Hints', 'Outcome', 'Time'].map(h => (
                        <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{h}</span>
                      ))}
                    </div>
                    {metrics.recent_sessions.map((s, i) => <SessionRow key={i} s={s} i={i} />)}
                  </div>
                </>
              )}

              {metrics.summary.total_sessions === 0 && (
                <div className="empty-metrics">
                  No data yet. Ask some questions and rate the hints to see analytics here.
                </div>
              )}

              {/* Interpretation guide */}
              <div className="interpretation">
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                  How to read this
                </p>
                {[
                  'Helpfulness rate > 70% means hints are well-targeted.',
                  'Avg hints < 2.0 means students solve problems quickly.',
                  'Direct answer rate < 30% means the Socratic method is working.',
                  'AI response time < 1000ms means a smooth user experience.',
                ].map((t, i) => (
                  <div key={i} className="interp-row">
                    <div className="interp-dot" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}