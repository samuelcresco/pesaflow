'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../api-client';

export default function ExternalDonations() {
  const [donations, setDonations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const res = await apiFetch('/api/savings/external-donations');
      const data = await res.json();
      setDonations(Array.isArray(data.donations) ? data.donations : []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    window.open('https://pesaflow-api-jpll.onrender.com/api/savings/external-donations/pdf', '_blank');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>💝 External Donations</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={downloadPDF} style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>📄 Download PDF</button>
          <a href="/savings" style={{ padding: '10px 20px', background: '#6b7280', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>← Back</a>
        </div>
      </div>

      {/* Total Card */}
      <div style={{ background: '#fef9e7', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
        <div style={{ fontSize: '14px', color: '#b45309' }}>Total External Donations</div>
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#b45309' }}>UGX {total.toLocaleString()}</div>
      </div>

      {donations.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No external donations yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Donor Name</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d, i) => (
                <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '12px' }}>{new Date(d.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{d.donorName || 'Anonymous'}</td>
                  <td style={{ padding: '12px' }}>{d.description || '—'}</td>
                  <td style={{ padding: '12px', fontWeight: '600' }}>UGX {d.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}