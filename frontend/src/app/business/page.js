'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../api-client';

export default function BusinessList() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'operating' });

  useEffect(() => { fetchBusinesses(); }, []);

  const fetchBusinesses = async () => {
    try {
      const res = await apiFetch('/api/business');
      const data = await res.json();
      setBusinesses(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/business', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      if (res.ok) {
        alert('Business created!');
        setShowAdd(false);
        setForm({ name: '', description: '', type: 'operating' });
        fetchBusinesses();
      } else {
        const d = await res.json();
        alert(d.error);
      }
    } catch (err) { alert('Network error'); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>💼 Business Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/business/profit-pool" style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>💰 Profit Pool</a>
          <button onClick={() => setShowAdd(true)} style={btnStyle('#2563eb')}>➕ Add Business</button>
        </div>
      </div>

      {businesses.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No businesses yet. Click "Add Business" to create one.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Name</th>
                <th style={th}>Type</th>
                <th style={th}>Capital Allocated</th>
                <th style={th}>Profit Extracted</th>
                <th style={th}>Current Balance</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b, i) => (
                <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}><strong>{b.name}</strong></td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{b.type}</td>
                  <td style={td}>UGX {(b.totalCapitalAllocated || 0).toLocaleString()}</td>
                  <td style={td}>UGX {(b.totalProfitExtracted || 0).toLocaleString()}</td>
                  <td style={{ ...td, fontWeight: '600', color: '#15803d' }}>UGX {(b.currentBalance || 0).toLocaleString()}</td>
                  <td style={td}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      background: b.status === 'active' ? '#d1fae5' : '#f1f5f9',
                      color: b.status === 'active' ? '#065f46' : '#475569'
                    }}>{b.status}</span>
                  </td>
                  <td style={td}>
                    <Link href={`/business/${b._id}`}>
                      <button style={{ ...btnStyle('#3b82f6', true) }}>View</button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div style={modalBg}>
          <div style={modalBox}>
            <h2 style={{ marginTop: 0 }}>Add Business</h2>
            <form onSubmit={handleCreate}>
              <div style={fieldStyle}>
                <label>Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={input} />
              </div>
              <div style={fieldStyle}>
                <label>Description</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input} />
              </div>
              <div style={fieldStyle}>
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={input}>
                  <option value="operating">Operating</option>
                  <option value="investment">Investment</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" style={btnStyle('#2563eb')}>Create</button>
                <button type="button" onClick={() => setShowAdd(false)} style={btnStyle('#6b7280')}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg, small = false) => ({
  padding: small ? '5px 12px' : '10px 20px',
  background: bg, color: '#fff', border: 'none',
  borderRadius: '8px', fontSize: small ? '12px' : '14px',
  fontWeight: '600', cursor: 'pointer'
});
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const td = { padding: '12px' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const fieldStyle = { marginBottom: '14px' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', padding: '30px', borderRadius: '16px', width: '480px', maxHeight: '90vh', overflow: 'auto' };