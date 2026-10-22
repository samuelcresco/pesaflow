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
    tin: '',
    logo: ''
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
          tin: data.tin || '',
          logo: data.logo || ''
        });
      }
    } catch (err) {
      console.error(err);
      setMsg('❌ Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  // ==================== LOGO UPLOAD ====================
   // Crop to square + clip into a circle → transparent PNG (same as member photo logic)
  const compressImage = (file, targetSize = 400) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const srcSize = Math.min(img.width, img.height);
          const sx = (img.width - srcSize) / 2;
          const sy = (img.height - srcSize) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          ctx.beginPath();
          ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, targetSize, targetSize);

          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('❌ Logo must be an image file');
      return;
    }
    try {
      setMsg('⏳ Processing logo…');
      const compressed = await compressImage(file, 400);
      setProfile(p => ({ ...p, logo: compressed }));
      setMsg('✅ Logo ready — click Save to keep it');
    } catch (err) {
      setMsg('❌ Could not process image');
    }
  };

  const removeLogo = () => {
    if (!confirm('Remove the club logo?')) return;
    setProfile(p => ({ ...p, logo: '' }));
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
        setMsg('✅ Saved! Certificates, receipts and vouchers will use these details.');
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
        These details appear at the top of every receipt, voucher, certificate, and statement PDF.
      </p>

      {msg && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: msg.startsWith('✅') ? '#dcfce7' : msg.startsWith('⏳') ? '#fef9e7' : '#fee2e2',
          color: msg.startsWith('✅') ? '#065f46' : msg.startsWith('⏳') ? '#b45309' : '#991b1b',
          fontWeight: '600'
        }}>{msg}</div>
      )}

      <form onSubmit={save} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>

        {/* ==================== LOGO UPLOAD ==================== */}
        <div style={{ marginBottom: '20px', padding: '18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, color: '#334155', fontSize: '14px' }}>
            🖼️ Club Logo
          </label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {profile.logo ? (
              <img
                src={profile.logo}
                alt="Club logo"
                style={{ width: '90px', height: '90px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '4px' }}
              />
            ) : (
              <div style={{ width: '90px', height: '90px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', borderRadius: '10px', color: '#94a3b8' }}>
                🏢
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px', display: 'inline-block', textAlign: 'center' }}>
                {profile.logo ? '🔄 Replace Logo' : '📤 Upload Logo'}
                <input type="file" accept="image/*" onChange={handleLogo} style={{ display: 'none' }} />
              </label>
              {profile.logo && (
                <button type="button" onClick={removeLogo} style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
                  🗑 Remove Logo
                </button>
              )}
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                PNG or JPG. Square works best. Used on certificates, receipts and vouchers.
              </p>
            </div>
          </div>
        </div>

        <Field label="Club Name *">
          <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} required style={input} />
        </Field>

        <Field label="Tagline / Description">
          <input type="text" value={profile.tagline} onChange={e => setProfile({ ...profile, tagline: e.target.value })} style={input} placeholder="e.g., STRENGTHEN WEALTH" />
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
        <strong>Preview of PDF header:</strong>
        <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '12px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          {profile.logo && <img src={profile.logo} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />}
          <div>
            <div style={{ fontWeight: '700' }}>{profile.name || '(Club Name)'}</div>
            <div>{profile.tagline || '(Tagline)'}</div>
            <div>{[profile.location, profile.address, profile.postalAddress, profile.contact, profile.email, profile.website].filter(Boolean).join(' • ') || '(contact info)'}</div>
            {(profile.registrationNumber || profile.tin) && (
              <div style={{ marginTop: '2px', fontSize: '11px' }}>
                {profile.registrationNumber && <>Reg No: {profile.registrationNumber}</>}
                {profile.registrationNumber && profile.tin && ' • '}
                {profile.tin && <>TIN: {profile.tin}</>}
              </div>
            )}
          </div>
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