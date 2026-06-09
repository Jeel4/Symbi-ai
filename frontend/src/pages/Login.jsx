// =============================================================================
// Login.jsx — Redesigned
// Design: split-screen layout. Left = brand panel. Right = form.
// All logic preserved exactly — only visual layer changed.
// =============================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Logo from '../components/Logo';
import '../design-system.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Small inline spinner using CSS animation
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(10,10,11,0.3)',
      borderTopColor: '#0a0a0b',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

export default function Login({ setUser }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError('Enter a valid email address.'); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      if (res.data.success) {
        setUser({ username: res.data.username, token: res.data.token });
        navigate('/hint');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-root {
          display: flex; min-height: 100vh; position: relative; z-index: 1;
        }
        /* Left brand panel */
        .auth-brand {
          display: none;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          width: 440px;
          flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 900px) { .auth-brand { display: flex; } }

        /* Decorative corner accent */
        .auth-brand::after {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(232,197,71,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .brand-tagline {
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--text-tertiary);
          line-height: 1.8;
          max-width: 280px;
        }
        .brand-features {
          display: flex; flex-direction: column; gap: 12px; margin-top: 32px;
        }
        .brand-feature {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: var(--text-secondary);
        }
        .brand-feature-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent); flex-shrink: 0;
        }
        .brand-quote {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-tertiary);
          line-height: 1.7;
          border-left: 2px solid var(--border-default);
          padding-left: 12px;
        }

        /* Right form panel */
        .auth-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }
        .auth-form-inner {
          width: 100%;
          max-width: 380px;
          animation: fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both;
        }
        .auth-form-header { margin-bottom: 32px; }
        .auth-form-title {
          font-size: 22px; font-weight: 600;
          color: var(--text-primary); margin-top: 24px; margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .auth-form-sub {
          font-size: 13px; color: var(--text-secondary);
        }

        .field { margin-bottom: 16px; }
        .field-label {
          display: block; font-size: 12px; font-weight: 500;
          color: var(--text-secondary); margin-bottom: 6px;
          letter-spacing: 0.02em; text-transform: uppercase;
        }

        .auth-error {
          display: flex; align-items: center; gap: 8px;
          background: var(--error-dim);
          border: 1px solid rgba(248,113,113,0.2);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          font-size: 13px; color: var(--error);
          margin-bottom: 16px;
          animation: fadeIn 0.2s ease both;
        }

        .auth-submit {
          width: 100%;
          padding: 11px;
          font-size: 14px;
          margin-top: 8px;
        }
        .auth-divider {
          display: flex; align-items: center; gap: 12px;
          margin: 20px 0;
        }
        .auth-divider-line {
          flex: 1; height: 1px; background: var(--border-subtle);
        }
        .auth-divider-text {
          font-size: 12px; color: var(--text-tertiary);
        }
        .auth-switch {
          text-align: center; font-size: 13px; color: var(--text-secondary);
        }
        .auth-switch-link {
          color: var(--accent); cursor: pointer; font-weight: 500;
          text-decoration: none; background: none; border: none;
          font-size: 13px; font-family: var(--font-sans);
          transition: color var(--transition-fast);
        }
        .auth-switch-link:hover { color: var(--accent-hover); }

        .mobile-logo {
          display: flex; justify-content: center; margin-bottom: 8px;
        }
        @media (min-width: 900px) { .mobile-logo { display: none; } }
      `}</style>

      <div className="auth-root">
        {/* Left — Brand Panel */}
        <div className="auth-brand">
          <Logo size="md" />
          <div>
            <p className="brand-tagline">
              A Socratic AI tutor that guides you to solutions through progressive hints — not answers.
            </p>
            <div className="brand-features">
              {[
                'Progressive 3-hint system',
                'LLaMA 3.3 70B via Groq',
                'Tracks your learning patterns',
                'JWT-secured, privacy-first',
              ].map(f => (
                <div key={f} className="brand-feature">
                  <div className="brand-feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          <p className="brand-quote">
            "Tell me and I forget.<br />
            Teach me and I remember.<br />
            Involve me and I learn."<br />
            — Benjamin Franklin
          </p>
        </div>

        {/* Right — Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <div className="mobile-logo"><Logo size="lg" /></div>
            <div className="auth-form-header">
              <div className="s-chip">secure login</div>
              <h1 className="auth-form-title">Welcome back</h1>
              <p className="auth-form-sub">Sign in to continue learning.</p>
            </div>

            {error && (
              <div className="auth-error">
                <span>⚠</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label">Email</label>
                <input
                  className="s-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label">Password</label>
                <input
                  className="s-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="s-btn-primary auth-submit"
                disabled={loading}
              >
                {loading ? <><Spinner /> Signing in…</> : 'Sign in →'}
              </button>
            </form>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            <p className="auth-switch">
              No account?{' '}
              <button className="auth-switch-link" onClick={() => navigate('/signup')}>
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}