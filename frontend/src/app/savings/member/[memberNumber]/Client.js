'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function MemberSavingsDetails() {
  const params = useParams();
  const router = useRouter();
  const memberNumber = params.memberNumber;

  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/');
      return;
    }

    const fetchMemberSavings = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/savings/member/${memberNumber}`);
        setMemberData(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load member savings.');
        setLoading(false);
      }
    };

    if (memberNumber) {
      fetchMemberSavings();
    }
  }, [memberNumber, router]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading member savings...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!memberData) return <div style={{ padding: '40px', textAlign: 'center' }}>No data found</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ color: '#0f3460' }}>Savings Details</h2>
        <a href="/savings" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back to Savings</a>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>{memberData.name}</h3>
        <p><strong>Member Number:</strong> {memberData.memberNumber}</p>
        <p><strong>Total Savings:</strong> UGX {memberData.total?.toLocaleString() || 0}</p>
      </div>

      {memberData.savings && memberData.savings.length > 0 ? (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Savings History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px' }}>Amount</th>
                <th style={{ padding: '12px' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {memberData.savings.map((saving, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px' }}>{new Date(saving.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{saving.description || 'Savings deposit'}</td>
                  <td style={{ padding: '12px' }}>UGX {saving.amount?.toLocaleString() || 0}</td>
                  <td style={{ padding: '12px' }}>{saving.type || 'deposit'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: '20px', color: '#666' }}>No savings records found for this member.</p>
      )}
    </div>
  );
}
