'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function AddMember() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    memberNumber: '',
    fname: '',
    lname: '',
    email: '',
    phoneNumber: '',
    address: '',
    occupation: '',
    dateOfBirth: '',
    idNumber: '',
    photo: '',
    ordinaryShares: 0,
    ordinaryAmount: 0,
    silverShares: 0,
    silverAmount: 0,
    goldenShares: 0,
    goldenAmount: 0,
    platinumShares: 0,
    platinumAmount: 0,
    nextOfKin: { fullName: '', relationship: '', contact: '', email: '', address: '' },
    password: ''
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('nok_')) {
      setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, [name.replace('nok_', '')]: value } });
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

  const generatePassword = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let pwd = '';
    for (let i = 0; i < 5; i++) pwd += letters.charAt(Math.floor(Math.random() * letters.length));
    setFormData({ ...formData, password: pwd });
  };

  const copyPassword = () => {
    if (!formData.password) return;
    navigator.clipboard.writeText(formData.password);
    alert('Password copied: ' + formData.password);
  };

  // ===== TOTALS =====
  const totalShares = 
    (parseInt(formData.ordinaryShares) || 0) +
    (parseInt(formData.silverShares) || 0) +
    (parseInt(formData.goldenShares) || 0) +
    (parseInt(formData.platinumShares) || 0);

  const totalValue = 
    ((parseInt(formData.ordinaryShares) || 0) * (parseFloat(formData.ordinaryAmount) || 0)) +
    ((parseInt(formData.silverShares) || 0) * (parseFloat(formData.silverAmount) || 0)) +
    ((parseInt(formData.goldenShares) || 0) * (parseFloat(formData.goldenAmount) || 0)) +
    ((parseInt(formData.platinumShares) || 0) * (parseFloat(formData.platinumAmount) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate total shares
    if (totalShares > 15) {
      setMessage('❌ Total shares cannot exceed 15');
      setLoading(false);
      return;
    }

    const payload = {
      firstName: formData.fname,
      surname: formData.lname,
      occupation: formData.occupation,
      contact: formData.phoneNumber,
      email: formData.email,
      address: formData.address,
      memberNumber: formData.memberNumber,
      dateOfBirth: formData.dateOfBirth,
      photo: formData.photo,
      shares: {
        golden: parseInt(formData.goldenShares) || 0,
        platinum: parseInt(formData.platinumShares) || 0,
        silver: parseInt(formData.silverShares) || 0,
        bronze: parseInt(formData.ordinaryShares) || 0
      },
      nextOfKin: {
        fullName: formData.nextOfKin.fullName,
        relationship: formData.nextOfKin.relationship,
        contact: formData.nextOfKin.contact,
        email: formData.nextOfKin.email,
        address: formData.nextOfKin.address
      }
    };

    try {
      const res = await axios.post('http://localhost:5000/api/members', payload);
      setMessage(`✅ Member created! Member No: ${formData.memberNumber} | Password: ${res.data.generatedPassword} — give this to the member.`);
      setTimeout(() => router.push('/members'), 4000);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to create member';
      setMessage(`❌ ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '950px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>Register New Member</h1>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: message.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : '#991b1b'
        }}>{message}</div>
      )}

      {/* PHOTO AT THE TOP */}
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
          <input name="memberNumber" value={formData.memberNumber} onChange={handleChange} placeholder="e.g., CRS2005/001" required style={input} />
        </Field>
        <Field label="First Name *">
          <input name="fname" value={formData.fname} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Surname *">
          <input name="lname" value={formData.lname} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Email *">
          <input name="email" type="email" value={formData.email} onChange={handleChange} required style={input} />
        </Field>
        <Field label="Phone Number *">
          <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required style={input} />
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
        <Field label="ID Number">
          <input name="idNumber" value={formData.idNumber} onChange={handleChange} style={input} />
        </Field>

        {/* SHARES */}
        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Shares</h3>
          <p style={{ color: '#64748b', fontSize: '13px' }}>Enter number of shares and amount per share. Total shares cannot exceed 15.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ marginBottom: '8px' }}>Ordinary Shares</h4>
              <Field label="Number of Shares"><input name="ordinaryShares" type="number" value={formData.ordinaryShares} onChange={handleChange} min="0" style={input} /></Field>
              <Field label="Amount per Share (UGX)"><input name="ordinaryAmount" type="number" value={formData.ordinaryAmount} onChange={handleChange} min="0" style={input} /></Field>
              <div style={valueStyle}>Value: UGX {((parseInt(formData.ordinaryShares) || 0) * (parseFloat(formData.ordinaryAmount) || 0)).toLocaleString()}</div>
            </div>
            <div>
              <h4 style={{ marginBottom: '8px' }}>Silver Shares</h4>
              <Field label="Number of Shares"><input name="silverShares" type="number" value={formData.silverShares} onChange={handleChange} min="0" style={input} /></Field>
              <Field label="Amount per Share (UGX)"><input name="silverAmount" type="number" value={formData.silverAmount} onChange={handleChange} min="0" style={input} /></Field>
              <div style={valueStyle}>Value: UGX {((parseInt(formData.silverShares) || 0) * (parseFloat(formData.silverAmount) || 0)).toLocaleString()}</div>
            </div>
            <div>
              <h4 style={{ marginBottom: '8px' }}>Golden Shares</h4>
              <Field label="Number of Shares"><input name="goldenShares" type="number" value={formData.goldenShares} onChange={handleChange} min="0" style={input} /></Field>
              <Field label="Amount per Share (UGX)"><input name="goldenAmount" type="number" value={formData.goldenAmount} onChange={handleChange} min="0" style={input} /></Field>
              <div style={valueStyle}>Value: UGX {((parseInt(formData.goldenShares) || 0) * (parseFloat(formData.goldenAmount) || 0)).toLocaleString()}</div>
            </div>
            <div>
              <h4 style={{ marginBottom: '8px' }}>Platinum Shares</h4>
              <Field label="Number of Shares"><input name="platinumShares" type="number" value={formData.platinumShares} onChange={handleChange} min="0" style={input} /></Field>
              <Field label="Amount per Share (UGX)"><input name="platinumAmount" type="number" value={formData.platinumAmount} onChange={handleChange} min="0" style={input} /></Field>
              <div style={valueStyle}>Value: UGX {((parseInt(formData.platinumShares) || 0) * (parseFloat(formData.platinumAmount) || 0)).toLocaleString()}</div>
            </div>
          </div>

          {/* TOTALS */}
          <div style={{
            marginTop: '16px',
            padding: '14px 20px',
            background: totalShares > 15 ? '#fee2e2' : '#eff6ff',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontWeight: '600',
            color: totalShares > 15 ? '#991b1b' : '#1e40af'
          }}>
            <span>Total Shares: {totalShares} / 15 {totalShares > 15 && ' — Exceeds!'}</span>
            <span>Total Value: UGX {totalValue.toLocaleString()}</span>
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

        {/* PASSWORD */}
      <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
  <h3>Password</h3>
  <p style={{ color: '#64748b', fontSize: '13px' }}>A password will be auto-generated. Member can change it after first login.</p>
  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
    <button type="button" onClick={generatePassword} style={btnSecondary}>Generate Password</button>
    {formData.password && (
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
          {formData.password}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(formData.password);
            alert('Password copied: ' + formData.password);
          }}
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
  {formData.password && (
    <p style={{ color: '#15803d', fontSize: '13px', marginTop: '8px' }}>
      ✅ Give this password to the member. They will use it to log in and can change it later.
    </p>
  )}
</div>


        {/* SUBMIT */}
        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" disabled={loading || totalShares > 15} style={{
            ...btnPrimary,
            opacity: (loading || totalShares > 15) ? 0.5 : 1
          }}>
            {loading ? 'Creating...' : 'Create Member'}
          </button>
          <button type="button" onClick={() => router.push('/members')} style={btnSecondary}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '10px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155', fontSize: '14px' }}>{label}</label>
    {children}
  </div>
);
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const valueStyle = { marginTop: '6px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '13px', color: '#475569', fontWeight: '600' };
const btnPrimary = { padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '15px' };
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' };