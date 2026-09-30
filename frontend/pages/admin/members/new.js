import { useState } from 'react';
import { useRouter } from 'next/router';

export default function NewMember() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    occupation: '',
    contact: '',
    email: '',
    address: '',
    memberNumber: '',
    dateOfBirth: '',
    shares: { golden: 0, platinum: 0, silver: 0, bronze: 0 },
    nextOfKin: {
      fullName: '',
      relationship: '',
      contact: '',
      email: '',
      address: ''
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('nok_')) {
      const field = name.replace('nok_', '');
      setForm({
        ...form,
        nextOfKin: { ...form.nextOfKin, [field]: value }
      });
    } else if (name.startsWith('share_')) {
      const type = name.replace('share_', '');
      setForm({
        ...form,
        shares: { ...form.shares, [type]: parseInt(value) || 0 }
      });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const generatePassword = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/members/generate-password');
      const data = await res.json();
      setGeneratedPassword(data.password);
    } catch (error) {
      alert('Failed to generate password');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const totalShares = form.shares.golden + form.shares.platinum + form.shares.silver + form.shares.bronze;
    if (totalShares > 15) {
      alert('Total shares cannot exceed 15');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Member created! Password: ${data.generatedPassword}`);
        router.push('/admin/members');
      } else {
        alert(data.error || 'Failed to create member');
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Register New Member</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label>First Name *</label>
          <input name="firstName" value={form.firstName} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Surname *</label>
          <input name="surname" value={form.surname} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Occupation</label>
          <input name="occupation" value={form.occupation} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Contact *</label>
          <input name="contact" value={form.contact} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Email *</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Address *</label>
          <input name="address" value={form.address} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Member Number *</label>
          <input name="memberNumber" value={form.memberNumber} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>
        <div>
          <label>Date of Birth *</label>
          <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
        </div>

        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Shares</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <div><label>Golden</label><input name="share_golden" type="number" value={form.shares.golden} onChange={handleChange} min="0" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Platinum</label><input name="share_platinum" type="number" value={form.shares.platinum} onChange={handleChange} min="0" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Silver</label><input name="share_silver" type="number" value={form.shares.silver} onChange={handleChange} min="0" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Bronze</label><input name="share_bronze" type="number" value={form.shares.bronze} onChange={handleChange} min="0" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
          </div>
          <div style={{ marginTop: '8px', padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Total Shares: </strong>
            {form.shares.golden + form.shares.platinum + form.shares.silver + form.shares.bronze}
            <span style={{ color: 'red', marginLeft: '12px' }}>Maximum: 15</span>
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Next of Kin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label>Full Name *</label><input name="nok_fullName" value={form.nextOfKin.fullName} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Relationship *</label><input name="nok_relationship" value={form.nextOfKin.relationship} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Contact *</label><input name="nok_contact" value={form.nextOfKin.contact} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div><label>Email</label><input name="nok_email" type="email" value={form.nextOfKin.email} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Address *</label><input name="nok_address" value={form.nextOfKin.address} onChange={handleChange} required style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', borderTop: '2px solid #eee', paddingTop: '16px' }}>
          <h3>Password</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" onClick={generatePassword} style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Generate Password</button>
            {generatedPassword && (
              <span style={{ padding: '8px 16px', background: '#f0f0f0', borderRadius: '4px', fontWeight: 'bold', fontSize: '18px' }}>{generatedPassword}</span>
            )}
          </div>
          <small>Generated password will be shown after saving</small>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Creating...' : 'Create Member'}
          </button>
          <button type="button" onClick={() => router.push('/admin/members')} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}