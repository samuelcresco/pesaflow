'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../api-client';

export default function ClubProfilePage() {
  const [profile, setProfile] = useState({
    name: '',
    tagline: '',
    location: '',
    address: '',
    postalAddress: '',
    contact: '',
    email: '',
    website: '',
    registrationNumber: '',
    tin: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/api/club-profile');
      const data = await res.json();
      if (data && !data.error) {
        setProfile({
          name: data.name || '',
          tagline: data.tagline || '',
          location: data.location || '',
          address: data.address || '',
          postalAddress: data.postalAddress || '',
          contact: data.contact || '',
          email: data.email || '',
          website: data.website || '',
          registrationNumber: data.registrationNumber || '',
          tin: data.tin || ''
        });
      }
    } catch (err) {
      console.error(err);
      setMsg('❌ Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await apiFetch('/api/club-profile', {
  method: 'PUT',
  body: JSON.stringify({ ...profile, updatedBy: 'admin' })
});
      const data = await res.json();
      if (res.ok) {
        setMsg('✅ Saved! New receipts will use these details.');
      } else {
        setMsg('❌ ' + (data.error || 'Failed'));
      }
    } catch (err) {
      setMsg('❌ Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>🏛️ Club Profile</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        These details appear at the top of every receipt, voucher, and statement PDF.
      </p>

      {msg && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#065f46' : '#991b1b',
          fontWeight: '600'
        }}>{msg}</div>
      )}

      <form onSubmit={save} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>

        <Field label="Club Name *">
          <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required style={input} />
        </Field>

        <Field label="Tagline / Description">
          <input type="text" value={profile.tagline} onChange={e => setProfile({ ...profile, tagline: e.target.value })} style={input} placeholder="e.g., SACCO Management Platform" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Location / City">
            <input type="text" value={profile.location} onChange={e => setProfile({ ...profile, location: e.target.value })} style={input} placeholder="e.g., Kampala, Uganda" />
          </Field>
          <Field label="Postal Address">
            <input type="text" value={profile.postalAddress} onChange={e => setProfile({ ...profile, postalAddress: e.target.value })} style={input} placeholder="e.g., P.O. Box 1234" />
          </Field>
        </div>

        <Field label="Physical Address">
          <input type="text" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} style={input} placeholder="e.g., Salaama Road, Plot 45" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Contact Phone(s)">
            <input type="text" value={profile.contact} onChange={e => setProfile({ ...profile, contact: e.target.value })} style={input} placeholder="e.g., +256 700 000 000" />
          </Field>
          <Field label="Email">
            <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} style={input} placeholder="e.g., info@crestedss.com" />
          </Field>
        </div>

        <Field label="Website">
          <input type="text" value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} style={input} placeholder="e.g., www.crestedss.com" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Registration Number">
            <input type="text" value={profile.registrationNumber} onChange={e => setProfile({ ...profile, registrationNumber: e.target.value })} style={input} placeholder="e.g., Reg No 12345" />
          </Field>
          <Field label="TIN">
            <input type="text" value={profile.tin} onChange={e => setProfile({ ...profile, tin: e.target.value })} style={input} placeholder="e.g., 1000000000" />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button type="submit" disabled={saving} style={{ padding: '12px 24px', background: saving ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
          <a href="/dashboard" style={{ padding: '12px 24px', background: '#6b7280', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>
            ← Back to Dashboard
          </a>
        </div>
      </form>

      <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px', color: '#475569' }}>
        <strong>Preview of receipt header:</strong>
        <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
          <div style={{ fontWeight: '700' }}>{profile.name || '(Club Name)'}</div>
          <div>{profile.tagline || '(Tagline)'}</div>
          <div>{[profile.location, profile.address, profile.postalAddress, profile.contact, profile.email, profile.website].filter(Boolean).join(' • ') || '(contact info)'}</div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>{label}</label>
    {children}
  </div>
);

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };