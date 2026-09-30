'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../api-client';

export default function DividendsPage() {
  const [dividends, setDividends] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ totalAmount: '', distributionDate: new Date().toISOString().split('T')[0] });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const res = await apiFetch('/api/dividends');
      const data = await res.json();
      setDividends(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const previewDiv = async () => {
    if (!form.totalAmount) return alert('Enter amount first');
    try {
      const res = await apiFetch('/api/dividends/preview', {
        method: 'POST',
        body: JSON.stringify({ totalAmount: parseFloat(form.totalAmount) })
      });
      const data = await res.json();
      setPreview(data);
    } catch (err) { alert('Error'); }
  };

  const confirm = async () => {
    if (!preview) return alert('Preview first');
    try {
      const res = await apiFetch('/api/dividends/distribute', {
        method: 'POST',
        body: JSON.stringify({
          totalAmount: parseFloat(form.totalAmount),
          distributionDate: form.distributionDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Distributed UGX ${data.totalDistributed.toLocaleString()}`);
        setModal(false);
        setPreview(null);
        setForm({ totalAmount: '', distributionDate: new Date().toISOString().split('T')[0] });
        fetchAll();
      } else {
        alert(data.error);
      }
    } catch (err) { alert('Network error'); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>💰 Dividend Distribution</h1>
        <button onClick={() => setModal(true)} style={btnStyle('#2563eb')}>➕ Distribute Dividends</button>
      </div>

      <div style={{ background: '#fef9e7', border: '1px solid #fcd34d', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
        <strong>📅 Window:</strong> Dividends can only be distributed <strong>December 1–15</strong>.
      </div>

      {dividends.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No dividends distributed yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Date</th>
                <th style={th}>Total Amount</th>
                <th style={th}>Members</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d, i) => (
                <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{new Date(d.distributionDate).toLocaleDateString()}</td>
                  <td style={td}>UGX {d.totalAmount.toLocaleString()}</td>
                  <td style={td}>{d.distributions.length}</td>
                  <td style={td}>
                    <button onClick={() => alert(JSON.stringify(d.distributions, null, 2))} style={btnStyle('#3b82f6', true)}>View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div style={modalBg}>
          <div style={modalBox}>
            <h2 style={{ marginTop: 0 }}>Distribute Dividends</h2>
            <Field label="Total Dividend Pool (UGX)">
              <input type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} style={input} />
            </Field>
            <Field label="Distribution Date">
              <input type="date" value={form.distributionDate} onChange={e => setForm({ ...form, distributionDate: e.target.value })} style={input} />
            </Field>
            <button type="button" onClick={previewDiv} style={{ ...btnStyle('#6b7280'), marginBottom: '16px' }}>Preview Distribution</button>

            {preview && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th2}>Member</th>
                      <th style={th2}>Platinum</th>
                      <th style={th2}>Golden</th>
                      <th style={th2}>Silver</th>
                      <th style={th2}>Bronze</th>
                      <th style={th2}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map(p => (
                      <tr key={p.memberId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td2}>{p.memberName}</td>
                        <td style={td2}>{p.amountFromPlatinum.toLocaleString()}</td>
                        <td style={td2}>{p.amountFromGolden.toLocaleString()}</td>
                        <td style={td2}>{p.amountFromSilver.toLocaleString()}</td>
                        <td style={td2}>{p.amountFromBronze.toLocaleString()}</td>
                        <td style={{ ...td2, fontWeight: '700', color: '#15803d' }}>{p.totalAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirm} style={btnStyle('#22c55e')} disabled={!preview}>Confirm Distribution</button>
              <button onClick={() => { setModal(false); setPreview(null); }} style={btnStyle('#6b7280')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg, small = false) => ({
  padding: small ? '5px 12px' : '10px 20px',
  background: bg, color: '#fff', border: 'none',
  borderRadius: '8px', fontSize: small ? '12px' : '14px', fontWeight: '600', cursor: 'pointer'
});
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const th2 = { padding: '6px', textAlign: 'left', fontWeight: '600', fontSize: '11px' };
const td = { padding: '12px' };
const td2 = { padding: '6px', fontSize: '12px' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', padding: '30px', borderRadius: '16px', width: '700px', maxHeight: '90vh', overflow: 'auto' };

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>{label}</label>
    {children}
  </div>
);