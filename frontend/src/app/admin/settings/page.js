'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function ClubSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  const [club, setClub] = useState({
    name: 'CRESTED SS',
    fullName: 'INVESTMENT CLUB LTD',
    shortName: 'CS',
    phone: '+256 700 000 000',
    email: 'info@crestedss.com',
    address: 'Kampala, Uganda',
    website: 'www.crestedss.com',
    primaryColor: '#0f3460',
    secondaryColor: '#1a1a2e'
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
    } else {
      router.push('/');
      return;
    }

    const saved = localStorage.getItem('clubSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setClub(parsed);
      } catch (e) {}
    }
    setLoading(false);
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClub({ ...club, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      localStorage.setItem('clubSettings', JSON.stringify(club));
      await axios.post('https://pesaflow-api-jpll.onrender.com/api/settings/club', club);
      setMessage('✅ Club settings saved successfully!');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err) {
      setMessage('❌ Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    marginTop: '5px'
  };

  const labelStyle = {
    display: 'block',
    fontWeight: '600',
    color: '#333',
    marginBottom: '5px'
  };

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ color: '#0f3460', margin: 0 }}>⚙️ Club Settings</h2>
        <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back</a>
      </div>

      <p style={{ color: '#666', marginTop: '10px' }}>Update your club's information. These details will appear on the dashboard.</p>

      {message && (
        <div style={{
          padding: '12px',
          marginTop: '15px',
          background: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '6px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Club Name *</label>
          <input type="text" name="name" value={club.name} onChange={handleChange} style={inputStyle} required />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Full Name *</label>
          <input type="text" name="fullName" value={club.fullName} onChange={handleChange} style={inputStyle} required />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Short Name (Logo text)</label>
          <input type="text" name="shortName" value={club.shortName} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Phone Number</label>
          <input type="text" name="phone" value={club.phone} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Email</label>
          <input type="email" name="email" value={club.email} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Address</label>
          <input type="text" name="address" value={club.address} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={labelStyle}>Website</label>
          <input type="text" name="website" value={club.website} onChange={handleChange} style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Primary Color</label>
            <input type="color" name="primaryColor" value={club.primaryColor} onChange={handleChange} style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '6px', height: '40px' }} />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={labelStyle}>Secondary Color</label>
            <input type="color" name="secondaryColor" value={club.secondaryColor} onChange={handleChange} style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '6px', height: '40px' }} />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            background: saving ? '#666' : '#0f3460',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer',
            marginTop: '10px'
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}