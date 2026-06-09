// =============================================================================
// SignUp.jsx — Redesigned
// Same layout language as Login. All auth logic identical.
// =============================================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Logo from '../components/Logo';
import '../design-system.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

export default function SignUp({ setUser }) {
  const [username, setUsername]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.'); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/register`, { username, email, password });
      if (res.data.success) {
        setUser({ username: res.data.username, token: res.data.token });
        navigate('/hint');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const strength = !password ? 0
    : password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
    : password.length >= 8 ? 2
    : 1;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', 'var(--error)', 'var(--warning)', 'var(--success)'];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-root {
          display: flex; min-height: 100vh; position: relative; z-index: 1;
        }
        .auth-brand {
          display: none; flex-direction: column; justify-content: space-between;
          padding: 48px; width: 440px; flex-shrink: 0;
          border-right: 1px solid var(--border-subtle);
          position: relative; overflow: hidden;
        }
        @media (min-width: 900px) { .auth-brand { display: flex; } }
        .auth-brand::after {
          content: ''; position: absolute; bottom: -60px; left: -60px;
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(232,197,71,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .step-list { display: flex; flex-direction: column; gap: 20px; margin-top: 32px; }
        .step-item { display: flex; gap: 14px; align-items: flex-start; }
        .step-num {
          width: 22px; height: 22px; border-radius: 50%;
          border: 1px solid var(--border-default);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-mono); font-size: 11px; color: var(--accent);
          flex-shrink: 0; margin-top: 1px;
        }
        .step-text { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
        .step-text strong { color: var(--text-primary); font-weight: 500; }

        .auth-form-panel {
          flex: 1; display: flex; align-items: center;
          justify-content: center; padding: 32px 24px;
        }
        .auth-form-inner {
          width: 100%; max-width: 380px;
          animation: fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both;
        }
        .auth-form-title {
          font-size: 22px; font-weight: 600; color: var(--text-primary);
          margin-top: 24px; margin-bottom: 6px; letter-spacing: -0.02em;
        }
        .auth-form-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 28px; }
        .field { margin-bottom: 14px; }
        .field-label {
          display: block; font-size: 12px; font-weight: 500;
          color: var(--text-secondary); margin-bottom: 6px;
          letter-spacing: 0.02em; text-transform: uppercase;
        }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .strength-bar { display: flex; gap: 3px; margin-top: 6px; }
        .strength-seg {
          height: 2px; flex: 1; border-radius: 1px;
          background: var(--border-default);
          transition: background 0.3s ease;
        }
        .strength-label { font-size: 11px; margin-top: 4px; font-family: var(--font-mono); }
        .auth-error {
          display: flex; align-items: center; gap: 8px;
          background: var(--error-dim); border: 1px solid rgba(248,113,113,0.2);
          border-radius: var(--radius-md); padding: 10px 12px;
          font-size: 13px; color: var(--error); margin-bottom: 16px;
          animation: fadeIn 0.2s ease both;
        }
        .auth-submit { width: 100%; padding: 11px; font-size: 14px; margin-top: 8px; }
        .auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .auth-divider-line { flex: 1; height: 1px; background: var(--border-subtle); }
        .auth-divider-text { font-size: 12px; color: var(--text-tertiary); }
        .auth-switch { text-align: center; font-size: 13px; color: var(--text-secondary); }
        .auth-switch-link {
          color: var(--accent); cursor: pointer; font-weight: 500;
          text-decoration: none; background: none; border: none;
          font-size: 13px; font-family: var(--font-sans);
          transition: color var(--transition-fast);
        }
        .auth-switch-link:hover { color: var(--accent-hover); }
        .mobile-logo { display: flex; justify-content: center; margin-bottom: 8px; }
        @media (min-width: 900px) { .mobile-logo { display: none; } }
      `}</style>

      <div className="auth-root">
        {/* Brand Panel */}
        <div className="auth-brand">
          <Logo size="md" />
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
              Join thousands of students who learn by thinking, not copying.
            </p>
            <div className="step-list">
              {[
                ['01', 'Ask your question', 'Type any coding problem you\'re stuck on.'],
                ['02', 'Get progressive hints', 'Three calibrated hints, each going deeper.'],
                ['03', 'Track your growth', 'See metrics on how you\'re improving over time.'],
              ].map(([n, title, desc]) => (
                <div key={n} className="step-item">
                  <div className="step-num">{n}</div>
                  <div className="step-text"><strong>{title}</strong><br />{desc}</div>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            Free during beta · No credit card required
          </p>
        </div>

        {/* Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <div className="mobile-logo"><Logo size="lg" /></div>
            <div className="s-chip">create account</div>
            <h1 className="auth-form-title">Get started</h1>
            <p className="auth-form-sub">Set up your account in seconds.</p>

            {error && <div className="auth-error"><span>⚠</span> {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div>
                  <label className="field-label">Username</label>
                  <input
                    className="s-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="jeel_patel"
                    maxLength={30}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input
                    className="s-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Password</label>
                <input
                  className="s-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                {password && (
                  <>
                    <div className="strength-bar">
                      {[1,2,3].map(i => (
                        <div
                          key={i}
                          className="strength-seg"
                          style={{ background: i <= strength ? strengthColor[strength] : 'var(--border-default)' }}
                        />
                      ))}
                    </div>
                    <p className="strength-label" style={{ color: strengthColor[strength] }}>
                      {strengthLabel[strength]}
                    </p>
                  </>
                )}
              </div>

              <div className="field">
                <label className="field-label">Confirm Password</label>
                <input
                  className="s-input"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Same password again"
                  style={{
                    borderColor: confirmPassword && confirmPassword !== password
                      ? 'var(--error)' : undefined
                  }}
                />
              </div>

              <button
                type="submit"
                className="s-btn-primary auth-submit"
                disabled={loading}
              >
                {loading ? <><Spinner /> Creating account…</> : 'Create account →'}
              </button>
            </form>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>
            <p className="auth-switch">
              Already have an account?{' '}
              <button className="auth-switch-link" onClick={() => navigate('/')}>Sign in</button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}