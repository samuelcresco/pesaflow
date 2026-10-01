'use client';

import { useEffect, useState } from 'react';

export default function AllTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const res = await fetch('https://pesaflow-api-jpll.onrender.com/api/savings');
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const deleteTxn = async (id) => {
    if (!confirm('Delete this transaction? It will be reversed.')) return;
    const res = await fetch(`https://pesaflow-api-jpll.onrender.com/api/savings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('✅ Deleted');
      fetchAll();
    } else {
      alert('Failed');
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  const filtered = filterCat === 'all' ? transactions : transactions.filter(t => t.category === filterCat);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📋 All Transactions</h1>
        <a href="/savings" style={{ color: '#2563eb', textDecoration: 'none' }}>← Back to Savings</a>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
          <option value="all">All Categories</option>
          <option value="monthly">Monthly</option>
          <option value="extra">Extra</option>
          <option value="penalty">Penalty</option>
          <option value="membership">Membership</option>
          <option value="shares">Shares</option>
          <option value="donation">Donation</option>
          <option value="misc">Miscellaneous</option>
          <option value="business_profit">Business Profit</option>
        </select>
        <div style={{ padding: '8px 16px', background: '#dbeafe', borderRadius: '6px', fontWeight: '600' }}>
          Total: UGX {total.toLocaleString()}
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              {['Date','Member','Category','Payment Type','Amount','Description','Actions'].map(h => (
                <th key={h} style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No transactions.</td></tr>
            ) : filtered.map((t, i) => (
              <tr key={t._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                <td style={{ padding: '10px' }}>{new Date(t.date).toLocaleDateString()}</td>
                <td style={{ padding: '10px' }}>
                  {t.memberId ? `${t.memberId.firstName} ${t.memberId.surname}` : 'Club'}
                </td>
                <td style={{ padding: '10px', textTransform: 'capitalize' }}>{t.category}</td>
                <td style={{ padding: '10px' }}>{t.paymentType || '—'}</td>
                <td style={{ padding: '10px', fontWeight: '600' }}>UGX {t.amount.toLocaleString()}</td>
                <td style={{ padding: '10px', color: '#64748b' }}>{t.description || '—'}</td>
                <td style={{ padding: '10px' }}>
                  <button onClick={() => deleteTxn(t._id)} style={{ padding: '5px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}