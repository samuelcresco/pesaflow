'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../api-client';

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'asset', description: '', purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: '', saleDate: new Date().toISOString().split('T')[0], salePrice: ''
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const res = await apiFetch('/api/investments');
      const data = await res.json();
      setInvestments(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleBuy = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/investments/buy', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, type: form.type, description: form.description,
          purchaseDate: form.purchaseDate, purchaseCost: parseFloat(form.purchaseCost)
        })
      });
      const d = await res.json();
      if (res.ok) {
        alert(`Asset purchased! Each member contributed UGX ${d.sharePerMember.toLocaleString()}`);
        setModal(null);
        setForm({ ...form, name: '', description: '', purchaseCost: '' });
        fetchAll();
      } else alert(d.error);
    } catch (err) { alert('Network error'); }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/investments/sell/${modal.id}`, {
        method: 'POST',
        body: JSON.stringify({ saleDate: form.saleDate, salePrice: parseFloat(form.salePrice) })
      });
      const d = await res.json();
      if (res.ok) {
        alert(`Asset sold! Each member received UGX ${d.sharePerMember.toLocaleString()}`);
        setModal(null);
        setForm({ ...form, salePrice: '' });
        fetchAll();
      } else alert(d.error);
    } catch (err) { alert('Network error'); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1>🏘️ Club Investments</h1>
        <button onClick={() => setModal('buy')} style={btn('#2563eb')}>➕ Buy Asset</button>
      </div>

      {investments.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No investments yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Name</th><th style={th}>Type</th><th style={th}>Purchase Date</th>
                <th style={th}>Cost</th><th style={th}>Status</th><th style={th}>Sale Price</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv, i) => (
                <tr key={inv._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{inv.name}</td>
                  <td style={td}>{inv.type}</td>
                  <td style={td}>{new Date(inv.purchaseDate).toLocaleDateString()}</td>
                  <td style={td}>UGX {inv.purchaseCost.toLocaleString()}</td>
                  <td style={td}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: inv.status === 'active' ? '#d1fae5' : '#f1f5f9', color: inv.status === 'active' ? '#065f46' : '#475569' }}>{inv.status}</span>
                  </td>
                  <td style={td}>{inv.salePrice ? `UGX ${inv.salePrice.toLocaleString()}` : '—'}</td>
                  <td style={td}>
                    {inv.status === 'active' && <button onClick={() => setModal({ type: 'sell', id: inv._id, name: inv.name })} style={btn('#ef4444', true)}>Sell</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'buy' && (
        <Modal onClose={() => setModal(null)} title="Buy Asset">
          <form onSubmit={handleBuy}>
            <Field label="Asset Name"><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={input} /></Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={input}>
                <option value="land">Land</option>
                <option value="property">Property</option>
                <option value="asset">Other Asset</option>
              </select>
            </Field>
            <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input} /></Field>
            <Field label="Purchase Cost (UGX)"><input type="number" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} required style={input} /></Field>
            <Field label="Purchase Date"><input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} required style={input} /></Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" style={btn('#2563eb')}>Buy</button>
              <button type="button" onClick={() => setModal(null)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {modal && modal.type === 'sell' && (
        <Modal onClose={() => setModal(null)} title={`Sell: ${modal.name}`}>
          <form onSubmit={handleSell}>
            <Field label="Sale Price (UGX)"><input type="number" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} required style={input} /></Field>
            <Field label="Sale Date"><input type="date" value={form.saleDate} onChange={e => setForm({ ...form, saleDate: e.target.value })} required style={input} /></Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" style={btn('#22c55e')}>Confirm Sale</button>
              <button type="button" onClick={() => setModal(null)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const btn = (bg, small = false) => ({ padding: small ? '5px 12px' : '10px 20px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontSize: small ? '12px' : '14px', fontWeight: '600', cursor: 'pointer' });
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const td = { padding: '12px' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const Field = ({ label, children }) => (<div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>{label}</label>{children}</div>);
const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '480px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);