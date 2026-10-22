'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function GroupSavings() {
  const router = useRouter();
  const [savings, setSavings] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } else {
      router.push('/');
      return;
    }

    const fetchGroupSavings = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/savings/group');
        setSavings(response.data.transactions || []);
        setTotalSavings(response.data.totalSavings || 0);
        setLoading(false);
      } catch (err) {
        setError('Failed to load group savings.');
        setLoading(false);
      }
    };

    fetchGroupSavings();
  }, [router]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading group savings...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ color: '#0f3460' }}>Group Savings</h2>
        <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back to Dashboard</a>
      </div>

      <div style={{ background: '#0f3460', color: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px', textAlign: 'center' }}>
        <h3 style={{ margin: 0 }}>Total Group Savings</h3>
        <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '5px 0 0 0' }}>UGX {totalSavings.toLocaleString()}</p>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Savings Transactions</h3>
        {savings.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No group savings transactions yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f0f2f5', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Amount (UGX)</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {savings.map((t, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px', color: t.amount < 0 ? 'red' : 'green' }}>
                    {t.amount < 0 ? '-' : ''} UGX {Math.abs(t.amount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px' }}>{t.description}</td>
                  <td style={{ padding: '12px' }}>{t.type || 'Savings'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
