// =============================================================================
// Profile.jsx — User profile page
// =============================================================================
// Shows: avatar initial, username, email, bio, join date, total stats
// Actions: edit bio, change password
// Same sidebar layout as HintGenerator and MetricsDashboard
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import '../design-system.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Spinner() {
  return <span style={{ display:'inline-block',width:14,height:14,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} />;
}

export default function Profile({ user, setUser }) {
  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [editingBio,   setEditingBio]   = useState(false);
  const [bio,          setBio]          = useState('');
  const [savingBio,    setSavingBio]    = useState(false);
  const [pwSection,    setPwSection]    = useState(false);
  const [currentPw,    setCurrentPw]    = useState('');
  const [newPw,        setNewPw]        = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [pwLoading,    setPwLoading]    = useState(false);
  const [msg,          setMsg]          = useState({ text:'', type:'' });
  const navigate = useNavigate();

  const headers = { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/profile`, { headers });
      if (res.status === 401) { setUser(null); navigate('/'); return; }
      const data = await res.json();
      setProfile(data);
      setBio(data.bio || '');
    } catch (e) { setMsg({ text: 'Failed to load profile', type: 'error' }); }
    finally { setLoading(false); }
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ bio }),
      });
      if (res.ok) {
        setProfile(p => ({ ...p, bio }));
        setEditingBio(false);
        setMsg({ text: 'Bio updated!', type: 'success' });
      }
    } finally { setSavingBio(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    if (newPw.length < 8) { setMsg({ text: 'New password must be at least 8 characters', type: 'error' }); return; }
    if (newPw !== confirmPw) { setMsg({ text: 'Passwords do not match', type: 'error' }); return; }
    setPwLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/profile/change-password`, {
        method: 'POST', headers,
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: 'Password changed successfully!', type: 'success' });
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        setPwSection(false);
      } else {
        setMsg({ text: data.error, type: 'error' });
      }
    } finally { setPwLoading(false); }
  };

  const joinDate = profile?.created_at
    ? new Date(profile.created_at * 1000).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        .profile-shell { display:flex; height:100vh; overflow:hidden; position:relative; z-index:1; }
        .profile-sidebar { width:240px; flex-shrink:0; border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; background:var(--bg-base); }
        @media(max-width:768px){ .profile-sidebar { display:none; } }
        .profile-main { flex:1; overflow-y:auto; padding:36px 40px; }
        @media(max-width:600px){ .profile-main { padding:20px 16px; } }
        .section-card { background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:24px; margin-bottom:16px; transition:border-color var(--transition-base); }
        .section-card:hover { border-color:var(--border-default); }
        .section-title { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-tertiary); margin-bottom:16px; }
        .avatar-circle { width:64px; height:64px; border-radius:50%; background:var(--accent-dim); border:2px solid rgba(232,197,71,0.3); display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:26px; color:var(--accent); font-weight:500; margin-bottom:16px; }
        .profile-name { font-size:22px; font-weight:600; color:var(--text-primary); letter-spacing:-0.02em; }
        .profile-email { font-size:13px; color:var(--text-tertiary); margin-top:2px; font-family:var(--font-mono); }
        .profile-join { font-size:12px; color:var(--text-tertiary); margin-top:8px; }
        .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px; }
        .stat-box { background:var(--bg-elevated); border-radius:var(--radius-md); padding:14px 16px; }
        .stat-value { font-family:var(--font-mono); font-size:22px; font-weight:500; color:var(--accent); }
        .stat-label { font-size:12px; color:var(--text-tertiary); margin-top:2px; }
        .bio-text { font-size:14px; color:var(--text-secondary); line-height:1.7; }
        .bio-empty { font-size:13px; color:var(--text-tertiary); font-style:italic; }
        .inline-actions { display:flex; gap:8px; margin-top:12px; }
        .msg-bar { border-radius:var(--radius-md); padding:10px 14px; font-size:13px; margin-bottom:16px; animation:fadeIn 0.2s ease both; }
        .msg-success { background:var(--success-dim); border:1px solid rgba(61,214,140,0.2); color:var(--success); }
        .msg-error { background:var(--error-dim); border:1px solid rgba(248,113,113,0.2); color:var(--error); }
        .pw-field { margin-bottom:12px; }
        .pw-label { display:block; font-size:12px; font-weight:500; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.02em; }
      `}</style>

      <div className="profile-shell">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <div style={{ padding:'20px 20px 16px',borderBottom:'1px solid var(--border-subtle)' }}>
            <Logo size="md" />
          </div>
          <nav style={{ flex:1,padding:'12px 10px' }}>
            {[
              { label:'Ask a question', icon:'◈', path:'/hint' },
              { label:'My stats',       icon:'◻', path:'/metrics' },
              { label:'Profile',        icon:'○', path:'/profile', active:true },
            ].map(item => (
              <div key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display:'flex',alignItems:'center',gap:9,padding:'7px 10px',
                  borderRadius:'var(--radius-sm)',fontSize:13,marginBottom:2,
                  cursor:'pointer',transition:'all var(--transition-fast)',
                  color: item.active ? 'var(--accent)' : 'var(--text-secondary)',
                  background: item.active ? 'var(--accent-muted)' : 'transparent',
                  border: item.active ? '1px solid rgba(232,197,71,0.15)' : '1px solid transparent',
                }}
              >
                <span style={{ width:18,textAlign:'center' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </nav>
          <div style={{ padding:'12px 10px',borderTop:'1px solid var(--border-subtle)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:'var(--radius-md)',background:'var(--bg-elevated)',marginBottom:8 }}>
              <div style={{ width:26,height:26,borderRadius:'50%',background:'var(--accent-dim)',border:'1px solid rgba(232,197,71,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)' }}>
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize:13,color:'var(--text-primary)',fontWeight:500,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.username}</span>
            </div>
            <button className="s-btn-danger" style={{ width:'100%',justifyContent:'center' }}
              onClick={() => { setUser(null); navigate('/'); }}>Sign out</button>
          </div>
        </aside>

        {/* Main */}
        <div className="profile-main">
          <h1 style={{ fontSize:20,fontWeight:600,color:'var(--text-primary)',letterSpacing:'-0.02em',marginBottom:4 }}>Profile</h1>
          <p style={{ fontSize:13,color:'var(--text-tertiary)',marginBottom:28 }}>Manage your account and preferences.</p>

          {msg.text && (
            <div className={`msg-bar ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {msg.text}
            </div>
          )}

          {loading ? (
            <div style={{ display:'flex',alignItems:'center',gap:10,color:'var(--text-tertiary)',fontSize:13 }}>
              <Spinner /> Loading…
            </div>
          ) : profile && (
            <>
              {/* Identity card */}
              <div className="section-card">
                <div className="avatar-circle">{profile.username?.[0]?.toUpperCase()}</div>
                <p className="profile-name">{profile.username}</p>
                <p className="profile-email">{profile.email}</p>
                <p className="profile-join">Member since {joinDate}</p>

                <div className="stat-row">
                  <div className="stat-box">
                    <p className="stat-value">{profile.total_hints ?? 0}</p>
                    <p className="stat-label">Hints received</p>
                  </div>
                  <div className="stat-box">
                    <p className="stat-value">{profile.total_sessions ?? 0}</p>
                    <p className="stat-label">Sessions</p>
                  </div>
                </div>
              </div>

              {/* Bio card */}
              <div className="section-card">
                <p className="section-title">Bio</p>
                {editingBio ? (
                  <>
                    <textarea
                      className="s-textarea"
                      value={bio}
                      onChange={e => setBio(e.target.value.slice(0, 300))}
                      rows={3}
                      placeholder="Tell us about yourself…"
                    />
                    <p style={{ fontSize:11,color:'var(--text-tertiary)',marginTop:4,fontFamily:'var(--font-mono)' }}>{bio.length}/300</p>
                    <div className="inline-actions">
                      <button className="s-btn-primary" style={{ padding:'7px 16px',fontSize:13 }}
                        onClick={saveBio} disabled={savingBio}>
                        {savingBio ? <Spinner /> : 'Save'}
                      </button>
                      <button className="s-btn-ghost" onClick={() => { setBio(profile.bio||''); setEditingBio(false); }}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {profile.bio
                      ? <p className="bio-text">{profile.bio}</p>
                      : <p className="bio-empty">No bio yet.</p>
                    }
                    <div className="inline-actions" style={{ marginTop:12 }}>
                      <button className="s-btn-ghost" onClick={() => setEditingBio(true)}>
                        {profile.bio ? 'Edit bio' : 'Add bio'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Change password card */}
              <div className="section-card">
                <p className="section-title">Security</p>
                {!pwSection ? (
                  <button className="s-btn-ghost" onClick={() => setPwSection(true)}>
                    Change password
                  </button>
                ) : (
                  <form onSubmit={changePassword}>
                    <div className="pw-field">
                      <label className="pw-label">Current password</label>
                      <input className="s-input" type="password" value={currentPw}
                        onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
                    </div>
                    <div className="pw-field">
                      <label className="pw-label">New password</label>
                      <input className="s-input" type="password" value={newPw}
                        onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" />
                    </div>
                    <div className="pw-field">
                      <label className="pw-label">Confirm new password</label>
                      <input className="s-input" type="password" value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)} placeholder="Same password again"
                        style={{ borderColor: confirmPw && confirmPw !== newPw ? 'var(--error)' : undefined }} />
                    </div>
                    <div className="inline-actions">
                      <button type="submit" className="s-btn-primary" style={{ padding:'7px 16px',fontSize:13 }} disabled={pwLoading}>
                        {pwLoading ? <Spinner /> : 'Update password'}
                      </button>
                      <button type="button" className="s-btn-ghost"
                        onClick={() => { setPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}