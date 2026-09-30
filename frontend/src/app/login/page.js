'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, saveSession } from '../api-client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || 'Login failed');
        setLoading(false);
        return;
      }
      saveSession(data.user, data.role || 'admin', data.cardAccess || 'all');
      router.replace('/dashboard');
    } catch (err) {
      setError('Network error. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '32px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontFamily: 'Segoe UI, sans-serif' }}>
      <h2 style={{ margin: 0, fontSize: '22px', textAlign: 'center' }}>CRESTED SS</h2>
      <p style={{ margin: '4px 0 28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Admin Login</p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#334155', fontWeight: 600 }}>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: '100%', padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#334155', fontWeight: 600 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', marginBottom: '20px', fontSize: '14px', boxSizing: 'border-box' }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#94a3b8' }}>
        © 2026 Crested SS Investment Club
      </p>
    </div>
  );
}