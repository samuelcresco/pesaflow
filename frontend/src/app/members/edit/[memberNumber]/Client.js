'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '../../../api-client';

// Remove paper background from a signature image (near-white → transparent)
const cleanSignature = (dataUrl, threshold = 190) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > threshold && g > threshold && b > threshold) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
};

export default function EditMember() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberNumber;

  const [formData, setFormData] = useState({
    memberNumber: '',
    firstName: '',
    surname: '',
    email: '',
    contact: '',
    address: '',
    occupation: '',
    dateOfBirth: '',
    photo: '',
    signature: '',
    cardQrMessage: '',
    shares: { golden: 0, platinum: 0, silver: 0, bronze: 0 },
    nextOfKin: { fullName: '', relationship: '', contact: '', email: '', address: '' }
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchMember();
  }, [memberId]);

  const fetchMember = async () => {
    try {
      const res = await apiFetch(`/api/members/${memberId}`);
      const m = await res.json();
      if (!res.ok) throw new Error(m.error || 'Failed to load member');
      setFormData({
        memberNumber: m.memberNumber || '',
        firstName: m.firstName || '',
        surname: m.surname || '',
        email: m.email || '',
        contact: m.contact || '',
        address: m.address || '',
        occupation: m.occupation || '',
        dateOfBirth: m.dateOfBirth ? m.dateOfBirth.split('T')[0] : '',
        photo: m.photo || '',
        signature: m.signature || '',
        cardQrMessage: m.cardQrMessage || '',
        shares: {
          golden: m.shares?.golden || 0,
          platinum: m.shares?.platinum || 0,
          silver: m.shares?.silver || 0,
          bronze: m.shares?.bronze || 0
        },
        nextOfKin: {
          fullName: m.nextOfKin?.fullName || '',
          relationship: m.nextOfKin?.relationship || '',
          contact: m.nextOfKin?.contact || '',
          email: m.nextOfKin?.email || '',
          address: m.nextOfKin?.address || ''
        }
      });
      if (m.photo) setPhotoPreview(m.photo);
      if (m.signature) setSignaturePreview(m.signature);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('nok_')) {
      setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, [name.replace('nok_', '')]: value } });
    } else if (name.startsWith('share_')) {
      const type = name.replace('share_', '');
      setFormData({ ...formData, shares: { ...formData.shares, [type]: parseInt(value) || 0 } });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const compressImage = (file, maxWidth = 600, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('❌ Only image files are allowed');
      return;
    }

    try {
      setMessage('⏳ Compressing photo…');
      const compressed = await compressImage(file, 600, 0.8);
      setPhotoPreview(compressed);
      setFormData({ ...formData, photo: compressed });
      setMessage('✅ Photo ready (' + Math.round(compressed.length / 1024) + ' KB)');
    } catch (err) {
      setMessage('❌ Could not process image');
    }
  };

  const handleSignature = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('❌ Only image files are allowed');
      return;
    }

    try {
      setMessage('⏳ Cleaning signature…');
      const compressed = await compressImage(file, 800, 0.85);
      const cleaned = await cleanSignature(compressed);
      setSignaturePreview(cleaned);
      setFormData({ ...formData, signature: cleaned });
      setMessage('✅ Signature ready (background removed). Click Save Changes.');
    } catch (err) {
      setMessage('❌ Could not process signature image');
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm('Remove this member\'s signature? It will no longer appear on their ID card.')) return;
    setSaving(true);
    setMessage('⏳ Removing signature…');
    try {
      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ signature: '' })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to remove signature');
      setSignaturePreview('');
      setFormData({ ...formData, signature: '' });
      setMessage('✅ Signature removed. Refresh to confirm.');
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(`Reset password for ${formData.firstName} ${formData.surname}? A new password will be generated.`)) return;
    setResetting(true);
    setNewPassword('');
    setMessage('⏳ Generating new password…');
    try {
      const res = await apiFetch(`/api/members/${memberId}/reset-password`, {
        method: 'PUT'
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Reset failed');
      setNewPassword(d.newPassword);
      setMessage('✅ Password reset — copy it and give it to the member');
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    alert('Copied: ' + newPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch(`/api/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Update failed');
      setMessage('✅ Member updated successfully');
      setTimeout(() => router.push('/members'), 1500);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading member...</div>;

  const totalShares = formData.shares.golden + formData.shares.platinum + formData.shares.silver + formData.shares.bronze;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>Edit Member</h1>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: message.startsWith('✅') ? '#dcfce7' : message.startsWith('⏳') ? '#fef9e7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : message.startsWith('⏳') ? '#b45309' : '#991b1b'
        }}>{message}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
        {photoPreview ? (
          <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>👤</div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Member Photo</label>
          <input type="file" accept="image/*" onChange={handlePhoto} />
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Large photos are compressed automatically before upload.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
        {signaturePreview ? (
          <img src={signaturePreview} alt="Signature" style={{ width: '160px', height: '70px', objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
        ) : (
          <div style={{ width: '160px', height: '70px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#64748b', borderRadius: '6px' }}>✍️</div>
        )}
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Member Signature</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={handleSignature} />
            {signaturePreview && (
              <button
                type="button"
                onClick={handleDeleteSignature}
                disabled={saving}
                style={{
                  padding: '8px 14px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                {saving ? 'Removing…' : '🗑 Remove Signature'}
              </button>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Photo of the member's signature on white paper.
          </p>
        </div>
      </div>

      {/* CARD QR MESSAGE */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Card QR Message (optional)</label>
        <textarea
          name="cardQrMessage"
          value={formData.cardQrMessage}
          onChange={handleChange}
          rows="2"
          placeholder="e.g., Certified member. Owns 10 shares."
          style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
          This message appears on the verify page when the QR code on the card is scanned.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>🔑 Password</label>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#78350f' }}>
            Forgot the member's password? Generate a new one and give it to them.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resetting}
              style={{
                padding: '10px 18px',
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: resetting ? 'wait' : 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              {resetting ? 'Generating…' : '🔑 Reset Password'}
            </button>
            {newPassword && (
              <>
                <span style={{
                  padding: '10px 20px',
                  background: '#dcfce7',
                  color: '#065f46',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '20px',
                  letterSpacing: '4px',
                  fontFamily: 'monospace'
                }}>
                  {newPassword}
                </span>
                <button
                  type="button"
                  onClick={copyPassword}
                  style={{
                    padding: '10px 16px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  📋 Copy
                </button>
              </>
            )}
          </div>
          {newPassword && (
            <p style={{ color: '#15803d', fontSize: '13px', marginTop: '8px' }}>
              ✅ Give this password to the member. They can log in and change it later.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Member Number *">
          <input name="memberNumber" value={formData.memberNumber} onChange={handleChange} required style={input} />
        </Field>
        <Field label="First Name *">
          <input name="firstName" value={formData.firstName} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Surname *">
          <input name="surname" value={formData.surname} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Email *">
          <input name="email" type="email" value={formData.email} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Phone Number *">
          <input name="contact" value={formData.contact} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Address *">
          <input name="address" value={formData.address} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Occupation">
          <input name="occupation" value={formData.occupation} onChange={handleChange} style={input} />
        </Field>
        <Field label="Date of Birth *">
          <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required style={input} />
        </Field>

        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Shares</h3>
          <p style={{ color: '#64748b', fontSize: '13px' }}>Total shares cannot exceed 15.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <Field label="Golden"><input name="share_golden" type="number" min="0" value={formData.shares.golden} onChange={handleChange} style={input} /></Field>
            <Field label="Platinum"><input name="share_platinum" type="number" min="0" value={formData.shares.platinum} onChange={handleChange} style={input} /></Field>
            <Field label="Silver"><input name="share_silver" type="number" min="0" value={formData.shares.silver} onChange={handleChange} style={input} /></Field>
            <Field label="Ordinary"><input name="share_bronze" type="number" min="0" value={formData.shares.bronze} onChange={handleChange} style={input} /></Field>
          </div>
          <div style={{
            marginTop: '12px',
            padding: '10px',
            background: totalShares > 15 ? '#fee2e2' : '#f1f5f9',
            borderRadius: '8px',
            color: totalShares > 15 ? '#991b1b' : '#334155',
            fontWeight: '600'
          }}>
            Total Shares: {totalShares} / 15
            {totalShares > 15 && ' — Exceeds maximum!'}
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Next of Kin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Full Name *"><input name="nok_fullName" value={formData.nextOfKin.fullName} onChange={handleChange} required style={input} /></Field>
            <Field label="Relationship *"><input name="nok_relationship" value={formData.nextOfKin.relationship} onChange={handleChange} required style={input} /></Field>
            <Field label="Contact *"><input name="nok_contact" value={formData.nextOfKin.contact} onChange={handleChange} required style={input} /></Field>
            <Field label="Email"><input name="nok_email" type="email" value={formData.nextOfKin.email} onChange={handleChange} style={input} /></Field>
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Address *"><input name="nok_address" value={formData.nextOfKin.address} onChange={handleChange} required style={input} /></Field>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" disabled={saving || totalShares > 15} style={{
            ...btnPrimary,
            opacity: (saving || totalShares > 15) ? 0.5 : 1,
            cursor: (saving || totalShares > 15) ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.push('/members')} style={btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>{label}</label>
    {children}
  </div>
);
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const btnPrimary = { padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '15px' };
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' };