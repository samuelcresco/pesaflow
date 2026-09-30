'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API } from '../api-client';

export default function DeliveryNotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const emptyForm = {
    recipientName: '', recipientContact: '', recipientAddress: '',
    deliveredBy: '', notes: '', date: new Date().toISOString().split('T')[0],
    items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: '' }]
  };

  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchNotes(); }, [statusFilter]);

  const fetchNotes = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await apiFetch(`/api/delivery-notes?${params.toString()}`);
      const data = await res.json();
      setNotes(data.deliveryNotes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx][field] = value;
    setForm({ ...form, items });
  };

  const addItemRow = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit: 'pcs', unitPrice: '' }] });
  const removeItemRow = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const submit = async () => {
    setMsg('');
    if (!form.recipientName.trim()) return setMsg('❌ Recipient name is required');
    const validItems = form.items.filter(i => i.description.trim() && Number(i.quantity) > 0);
    if (validItems.length === 0) return setMsg('❌ Add at least one item with description and quantity');

    try {
      const res = await apiFetch('/api/delivery-notes', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          items: validItems.map(i => ({
            description: i.description,
            quantity: Number(i.quantity),
            unit: i.unit || 'pcs',
            unitPrice: Number(i.unitPrice) || 0
          }))
        })
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(`✅ Delivery note ${d.deliveryNote.noteNumber} created`);
        setTimeout(() => {
          setShowCreate(false);
          setForm(emptyForm);
          setMsg('');
          fetchNotes();
        }, 1000);
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  const markDelivered = async (id) => {
    try {
      const res = await apiFetch(`/api/delivery-notes/${id}/mark-delivered`, { method: 'PUT' });
      if (res.ok) fetchNotes();
    } catch (err) { alert('Network error'); }
  };

  const cancelNote = async (id, noteNumber) => {
    const reason = prompt(`Reason for cancelling ${noteNumber}?`);
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/delivery-notes/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason, cancelledBy: 'admin' })
      });
      if (res.ok) fetchNotes();
    } catch (err) { alert('Network error'); }
  };

  const deleteNote = async (id, noteNumber) => {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${noteNumber}?`)) return;
    if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
    try {
      const res = await apiFetch(`/api/delivery-notes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchNotes();
    } catch (err) { alert('Network error'); }
  };

  const totalValue = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (n.noteNumber || '').toLowerCase().includes(q) || (n.recipientName || '').toLowerCase().includes(q) || (n.recipientContact || '').includes(q);
  });

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>📄 Delivery Notes</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '13px' }}>Record goods delivered to customers or recipients</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/dashboard" style={btnSecondary}>← Dashboard</a>
          <button onClick={() => setShowCreate(true)} style={btn('#0891b2')}>➕ New Delivery Note</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by note #, recipient, or contact..." style={{ ...input, maxWidth: '400px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...input, maxWidth: '180px' }}>
          <option value="">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>{search ? 'No delivery notes match.' : 'No delivery notes yet.'}</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Note #</th><th style={th}>Date</th><th style={th}>Recipient</th>
                <th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Total Value</th>
                <th style={th}>Status</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n, i) => (
                <tr key={n._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{n.noteNumber}</td>
                  <td style={td}>{new Date(n.date).toLocaleDateString()}</td>
                  <td style={td}>
                    {n.recipientName}
                    {n.recipientContact && <div style={{ fontSize: '11px', color: '#64748b' }}>{n.recipientContact}</div>}
                  </td>
                  <td style={td}>{n.items?.length || 0}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700' }}>{n.totalValue > 0 ? `UGX ${Number(n.totalValue).toLocaleString()}` : '—'}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                      background: n.status === 'issued' ? '#e0f2fe' : n.status === 'delivered' ? '#dcfce7' : '#fee2e2',
                      color: n.status === 'issued' ? '#0369a1' : n.status === 'delivered' ? '#065f46' : '#991b1b'
                    }}>{n.status}</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                      <a href={`${API}/api/delivery-notes/${n._id}/pdf`} target="_blank" rel="noopener noreferrer" style={btnMini('#7c3aed')}>📄</a>
                      {n.status === 'issued' && <button onClick={() => markDelivered(n._id)} style={btnMini('#22c55e')}>✓ Delivered</button>}
                      {n.status !== 'cancelled' && <button onClick={() => cancelNote(n._id, n.noteNumber)} style={btnMini('#f59e0b')}>⊘</button>}
                      <button onClick={() => deleteNote(n._id, n.noteNumber)} style={btnMini('#dc2626')}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="➕ New Delivery Note" wide>
          {msg && <div style={{ padding: '10px', borderRadius: '8px', marginBottom: '14px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontSize: '13px', fontWeight: '600' }}>{msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Recipient Name *"><input type="text" value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} style={input} /></Field>
            <Field label="Recipient Contact"><input type="text" value={form.recipientContact} onChange={e => setForm({ ...form, recipientContact: e.target.value })} style={input} /></Field>
          </div>
          <Field label="Recipient Address"><input type="text" value={form.recipientAddress} onChange={e => setForm({ ...form, recipientAddress: e.target.value })} style={input} /></Field>

          <h4 style={{ margin: '12px 0 8px 0', fontSize: '13px', color: '#334155' }}>Items</h4>
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1.5fr auto', gap: '6px', marginBottom: '6px', alignItems: 'end' }}>
              <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" style={input} />
              <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" style={input} />
              <input type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Unit" style={input} />
              <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} placeholder="Unit Price" style={input} />
              {form.items.length > 1 && <button onClick={() => removeItemRow(idx)} style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
            </div>
          ))}
          <button onClick={addItemRow} style={{ padding: '6px 14px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', marginBottom: '14px' }}>➕ Add Row</button>

          {totalValue > 0 && (
            <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '14px' }}>
              <span>TOTAL VALUE</span><span>UGX {totalValue.toLocaleString()}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Delivered By"><input type="text" value={form.deliveredBy} onChange={e => setForm({ ...form, deliveredBy: e.target.value })} style={input} /></Field>
            <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={input} /></Field>
          </div>
          <Field label="Notes"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={input} /></Field>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={submit} style={btn('#0891b2')}>Create & Generate PDF</button>
            <button onClick={() => setShowCreate(false)} style={btn('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const Modal = ({ children, onClose, title, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: wide ? '800px' : '520px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const btn = (bg) => ({ padding: '10px 18px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' });
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', textDecoration: 'none', display: 'inline-block' });
const btnSecondary = { padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', display: 'inline-block' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };