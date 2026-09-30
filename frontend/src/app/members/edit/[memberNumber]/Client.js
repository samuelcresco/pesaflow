'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';

export default function EditMember() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberNumber; // this is actually the _id

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
    shares: { golden: 0, platinum: 0, silver: 0, bronze: 0 },
    nextOfKin: { fullName: '', relationship: '', contact: '', email: '', address: '' }
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMember();
  }, [memberId]);

  const fetchMember = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/members/${memberId}`);
      const m = res.data;
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
    } catch (err) {
      setMessage('❌ Failed to load member');
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

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setFormData({ ...formData, photo: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await axios.put(`http://localhost:5000/api/members/${memberId}`, formData);
      setMessage('✅ Member updated successfully');
      setTimeout(() => router.push('/members'), 1500);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.error || err.message));
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
          background: message.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : '#991b1b'
        }}>{message}</div>
      )}

      {/* PHOTO AT TOP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
        {photoPreview ? (
          <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>👤</div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Member Photo</label>
          <input type="file" accept="image/*" onChange={handlePhoto} />
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

        {/* SHARES */}
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

        {/* NEXT OF KIN */}
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

        {/* SUBMIT */}
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