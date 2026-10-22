import { useState } from 'react';
import { useRouter } from 'next/router';
import { API, saveSession } from '../app/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const u = username.trim().toLowerCase();

      if (u === 'admin') {
        const res = await fetch(`${API}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          saveSession(data.admin, 'admin', 'all');
          router.push('/dashboard');
        } else {
          setError(data.error || 'Login failed');
          setLoading(false);
        }
      } else {
        const res = await fetch(`${API}/api/leaders/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          saveSession(data.user, data.user.role, data.user.cardAccess || []);
          if (data.user.mustChangePassword) {
            localStorage.setItem('mustChangePassword', 'true');
            router.push('/change-password');
          } else {
            router.push('/dashboard');
          }
        } else {
          setError(data.error || 'Login failed');
          setLoading(false);
        }
      }
    } catch (err) {
      setError('Network error — is backend running?');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', padding: '48px 40px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>CRESTED SS</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>INVESTMENT CLUB LTD</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Admin & Staff Login</div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin or your username"
              required
              style={{ width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', background: '#f8fafc' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ width: '100%', padding: '12px 16px', paddingRight: '48px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', background: '#f8fafc' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#94a3b8' }}>
          <a href="/member-login" style={{ color: '#64748b', textDecoration: 'none' }}>→ Member login instead?</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          &copy; {new Date().getFullYear()} Crested SS Investment Club
        </div>
      </div>
    </div>
  );
}