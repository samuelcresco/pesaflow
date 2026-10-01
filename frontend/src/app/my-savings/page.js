'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function MySavings() {
  const [savings, setSavings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Fetch member's savings
      fetchSavings(parsedUser.memberNumber);
    } else {
      window.location.href = '/';
    }
  }, []);

  const fetchSavings = async (memberNumber) => {
    try {
      const response = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/savings/member/${memberNumber}`);
      setSavings(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load your savings.');
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading your savings...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!savings) return <div style={{ padding: '40px', textAlign: 'center' }}>No savings found.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>💰 My Savings</h1>
      
      <div style={{ background: '#0f3460', color: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <p style={{ margin: 0 }}><strong>Member:</strong> {savings.name}</p>
        <p style={{ margin: '5px 0 0 0' }}><strong>Member Number:</strong> {savings.memberNumber}</p>
        <p style={{ margin: '5px 0 0 0', fontSize: '20px' }}><strong>Total Savings:</strong> UGX {savings.totalSavings?.toLocaleString() || 0}</p>
      </div>

      <h3 style={{ marginTop: '20px' }}>Savings History</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f2f5', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Date</th>
              <th style={{ padding: '12px' }}>Amount (UGX)</th>
              <th style={{ padding: '12px' }}>Type</th>
              <th style={{ padding: '12px' }}>Description</th>
              <th style={{ padding: '12px' }}>Balance (UGX)</th>
            </tr>
          </thead>
          <tbody>
            {savings.savingsHistory && savings.savingsHistory.length > 0 ? (
              savings.savingsHistory.map((entry, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px' }}>{new Date(entry.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{entry.amount.toLocaleString()}</td>
                  <td style={{ padding: '12px' }}>{entry.type || 'Deposit'}</td>
                  <td style={{ padding: '12px' }}>{entry.description || '-'}</td>
                  <td style={{ padding: '12px' }}>{entry.balance?.toLocaleString() || 0}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>No savings history yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <br />
      <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none', fontWeight: 'bold' }}>← Back to Dashboard</a>
    </div>
  );
}