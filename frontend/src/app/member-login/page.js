'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:5000';

export default function MemberLogin() {
  const router = useRouter();
  const [memberNumber, setMemberNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetForm, setResetForm] = useState({ memberNumber: '', contact: '', email: '', newPassword: '' });
  const [resetMsg, setResetMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/member/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberNumber, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('member', JSON.stringify(data.member));
        localStorage.setItem('token', 'member-session');
        router.push('/member');
      } else {
        setError(data.error || 'Login failed');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error — is backend running?');
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetMsg('');
    try {
      const res = await fetch(`${API}/api/member/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetForm)
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg('✅ Password reset! You can now log in.');
        setTimeout(() => setShowForgot(false), 2500);
      } else {
        setResetMsg('❌ ' + (data.error || 'Reset failed'));
      }
    } catch (err) {
      setResetMsg('❌ Network error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', padding: '48px 40px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>CRESTED SS</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>INVESTMENT CLUB LTD</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Member Portal</div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Member Number</label>
            <input type="text" value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="e.g., CRS2005/001" required style={{ width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', background: '#f8fafc' }} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required style={{ width: '100%', padding: '12px 16px', paddingRight: '48px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', background: '#f8fafc' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="button" onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            Forgot Password?
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          <a href="/login" style={{ color: '#64748b', textDecoration: 'none' }}>→ Staff login instead?</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
          &copy; {new Date().getFullYear()} Crested SS Investment Club
        </div>
      </div>

      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '460px', maxWidth: '90vw' }}>
            <h2 style={{ marginTop: 0 }}>🔑 Reset Password</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              Verify your identity using the phone number OR email registered with the club.
            </p>

            {resetMsg && <p style={{ padding: '10px', borderRadius: '8px', background: '#f1f5f9' }}>{resetMsg}</p>}

            <form onSubmit={handleReset}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Member Number</label>
                <input type="text" value={resetForm.memberNumber} onChange={e => setResetForm({ ...resetForm, memberNumber: e.target.value })} required style={input} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Registered Phone Number</label>
                <input type="text" value={resetForm.contact} onChange={e => setResetForm({ ...resetForm, contact: e.target.value })} placeholder="OR use email below" style={input} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Registered Email</label>
                <input type="email" value={resetForm.email} onChange={e => setResetForm({ ...resetForm, email: e.target.value })} placeholder="OR use phone above" style={input} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>New Password</label>
                <input type="password" value={resetForm.newPassword} onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })} required minLength="6" style={input} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ padding: '10px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Reset Password</button>
                <button type="button" onClick={() => setShowForgot(false)} style={{ padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };