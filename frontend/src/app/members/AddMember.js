'use client';
import { useState } from 'react';
import axios from 'axios';

export default function AddMember() {
  const [formData, setFormData] = useState({
    memberNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    // Share types with admin-entered values
    ordinaryShares: 0,
    ordinaryAmount: 0,
    silverShares: 0,
    silverAmount: 0,
    goldenShares: 0,
    goldenAmount: 0,
    platinumShares: 0,
    platinumAmount: 0,
    tempPassword: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate total shares
  const totalShares = () => {
    return (
      (parseInt(formData.ordinaryShares) || 0) +
      (parseInt(formData.silverShares) || 0) +
      (parseInt(formData.goldenShares) || 0) +
      (parseInt(formData.platinumShares) || 0)
    );
  };

  // Calculate value for each share type
  const shareValue = (shares, amount) => {
    return (parseInt(shares) || 0) * (parseInt(amount) || 0);
  };

  // Calculate total value
  const totalValue = () => {
    return (
      shareValue(formData.ordinaryShares, formData.ordinaryAmount) +
      shareValue(formData.silverShares, formData.silverAmount) +
      shareValue(formData.goldenShares, formData.goldenAmount) +
      shareValue(formData.platinumShares, formData.platinumAmount)
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear messages when user types
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.memberNumber || !formData.firstName || !formData.lastName) {
      setError('Member Number, First Name, and Last Name are required.');
      return;
    }

    if (totalShares() === 0) {
      setError('At least one share must be assigned.');
      return;
    }

    if (totalShares() > 15) {
      setError('Total shares cannot exceed 15.');
      return;
    }

    try {
      const memberData = {
        memberNumber: formData.memberNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        shares: {
          ordinary: { count: parseInt(formData.ordinaryShares) || 0, amount: parseInt(formData.ordinaryAmount) || 0 },
          silver: { count: parseInt(formData.silverShares) || 0, amount: parseInt(formData.silverAmount) || 0 },
          golden: { count: parseInt(formData.goldenShares) || 0, amount: parseInt(formData.goldenAmount) || 0 },
          platinum: { count: parseInt(formData.platinumShares) || 0, amount: parseInt(formData.platinumAmount) || 0 }
        },
        totalShares: totalShares(),
        totalValue: totalValue(),
        tempPassword: formData.tempPassword || 'password123'
      };

      const response = await axios.post('http://localhost:5000/api/members', memberData);
      setSuccess('Member created successfully!');
      setFormData({
        memberNumber: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        ordinaryShares: 0,
        ordinaryAmount: 0,
        silverShares: 0,
        silverAmount: 0,
        goldenShares: 0,
        goldenAmount: 0,
        platinumShares: 0,
        platinumAmount: 0,
        tempPassword: ''
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create member.');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h2 style={{ color: '#0f3460' }}>Add New Member</h2>
      <p style={{ color: '#666' }}>Fill in all details to register a new club member.</p>

      {error && <div style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Basic Information</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label>Member Number *</label>
            <input type="text" name="memberNumber" value={formData.memberNumber} onChange={handleChange} placeholder="e.g., MEM001" style={inputStyle} required />
          </div>
          <div>
            <label>Temporary Password</label>
            <input type="text" name="tempPassword" value={formData.tempPassword} onChange={handleChange} placeholder="e.g., password123" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label>First Name *</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="First Name" style={inputStyle} required />
          </div>
          <div>
            <label>Last Name *</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Last Name" style={inputStyle} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="member@email.com" style={inputStyle} />
          </div>
          <div>
            <label>Phone Number</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g., 0712345678" style={inputStyle} />
          </div>
        </div>

        <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>Share Information</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>Enter number of shares and amount per share for each type. Total shares cannot exceed 15.</p>

        {/* Ordinary Shares */}
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
          <h4>Ordinary Shares</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label>Number of Shares</label>
              <input type="number" name="ordinaryShares" value={formData.ordinaryShares} onChange={handleChange} min="0" max="15" style={inputStyle} />
            </div>
            <div>
              <label>Amount per Share (UGX)</label>
              <input type="number" name="ordinaryAmount" value={formData.ordinaryAmount} onChange={handleChange} min="0" placeholder="e.g., 100000" style={inputStyle} />
            </div>
            <div>
              <label>Value</label>
              <p style={{ fontWeight: 'bold', color: '#0f3460' }}>UGX {shareValue(formData.ordinaryShares, formData.ordinaryAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Silver Shares */}
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
          <h4>Silver Shares</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label>Number of Shares</label>
              <input type="number" name="silverShares" value={formData.silverShares} onChange={handleChange} min="0" max="15" style={inputStyle} />
            </div>
            <div>
              <label>Amount per Share (UGX)</label>
              <input type="number" name="silverAmount" value={formData.silverAmount} onChange={handleChange} min="0" placeholder="e.g., 200000" style={inputStyle} />
            </div>
            <div>
              <label>Value</label>
              <p style={{ fontWeight: 'bold', color: '#0f3460' }}>UGX {shareValue(formData.silverShares, formData.silverAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Golden Shares */}
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
          <h4>Golden Shares</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label>Number of Shares</label>
              <input type="number" name="goldenShares" value={formData.goldenShares} onChange={handleChange} min="0" max="15" style={inputStyle} />
            </div>
            <div>
              <label>Amount per Share (UGX)</label>
              <input type="number" name="goldenAmount" value={formData.goldenAmount} onChange={handleChange} min="0" placeholder="e.g., 500000" style={inputStyle} />
            </div>
            <div>
              <label>Value</label>
              <p style={{ fontWeight: 'bold', color: '#0f3460' }}>UGX {shareValue(formData.goldenShares, formData.goldenAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Platinum Shares */}
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
          <h4>Platinum Shares</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label>Number of Shares</label>
              <input type="number" name="platinumShares" value={formData.platinumShares} onChange={handleChange} min="0" max="15" style={inputStyle} />
            </div>
            <div>
              <label>Amount per Share (UGX)</label>
              <input type="number" name="platinumAmount" value={formData.platinumAmount} onChange={handleChange} min="0" placeholder="e.g., 1000000" style={inputStyle} />
            </div>
            <div>
              <label>Value</label>
              <p style={{ fontWeight: 'bold', color: '#0f3460' }}>UGX {shareValue(formData.platinumShares, formData.platinumAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div style={{ background: '#0f3460', color: 'white', padding: '15px', borderRadius: '6px', marginTop: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <strong>Total Shares:</strong> {totalShares()} / 15
            </div>
            <div>
              <strong>Total Value:</strong> UGX {totalValue().toLocaleString()}
            </div>
          </div>
          {totalShares() > 15 && <p style={{ color: '#ff6b6b', marginTop: '5px' }}>⚠️ Total shares cannot exceed 15!</p>}
        </div>

        <button type="submit" style={{ width: '100%', padding: '14px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px' }}>
          Create Member
        </button>
      </form>
    </div>
  );
}

// Reusable input style
const inputStyle = {
  width: '100%',
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  marginTop: '5px',
  fontSize: '14px'
};
