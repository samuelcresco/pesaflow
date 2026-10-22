'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:5000';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mustChange, setMustChange] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = localStorage.getItem('admin') || localStorage.getItem('user');
    if (!data) {
      router.replace('/login');
      return;
    }
    try { setUser(JSON.parse(data)); } catch { router.replace('/login'); }
    setMustChange(localStorage.getItem('mustChangePassword') === 'true');
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (form.newPassword.length < 6) return setMsg('❌ Password must be at least 6 characters');
    if (form.newPassword !== form.confirm) return setMsg('❌ Passwords do not match');

    setLoading(true);
    try {
      const role = localStorage.getItem('role');
      const endpoint = (role === 'admin')
        ? `${API}/api/admin/${user.id}/change-password`
        : `${API}/api/leaders/${user.id}/change-password`;

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      const d = await res.json();
      if (res.ok) {
        localStorage.setItem('mustChangePassword', 'false');
        setMsg('✅ Password changed successfully');
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch (err) {
      setMsg('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f3460', padding: '20px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', maxWidth: '460px', width: '100%' }}>
        <h1 style={{ margin: 0, fontSize: '22px' }}>🔒 Change Password</h1>
        {mustChange && (
          <div style={{ background: '#fef9e7', border: '1px solid #fcd34d', padding: '12px', borderRadius: '8px', marginTop: '14px', fontSize: '13px', color: '#92400e' }}>
            <strong>⚠️ First-time login</strong><br />
            You must change your password before continuing.
          </div>
        )}

        {msg && (
          <div style={{ padding: '12px', borderRadius: '8px', marginTop: '16px', fontSize: '13px', fontWeight: '600', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b' }}>
            {msg}
          </div>
        )}

        <form onSubmit={submit} style={{ marginTop: '20px' }}>
          <Field label="Current Password">
            <input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} required style={input} />
          </Field>
          <Field label="New Password">
            <input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} required minLength="6" style={input} />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required style={input} />
          </Field>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Saving...' : 'Change Password'}
            </button>
            {!mustChange && (
              <button type="button" onClick={() => router.push('/dashboard')} style={{ padding: '12px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };