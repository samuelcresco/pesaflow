'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API } from '../../api-client';

const ROLES = [
  { value: 'president', label: 'President' },
  { value: 'vice_president', label: 'Vice President' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'chairman_loan_committee', label: 'Chairman — Loan Committee' },
  { value: 'chair_investment_committee', label: 'Chair — Investment Committee' },
  { value: 'loan_officer_1', label: 'Loan Officer 1' },
  { value: 'loan_officer_2', label: 'Loan Officer 2' },
  { value: 'it_technician', label: 'IT Technician / Admin' },
  { value: 'treasurer_loan_committee', label: 'Treasurer — Loan Committee' }
];

const ALL_CARDS = [
  { id: 'members', label: '👥 Members' },
  { id: 'savings', label: '💰 Savings' },
  { id: 'loans', label: '🏦 Loans' },
  { id: 'withdrawals', label: '💸 Withdrawals' },
  { id: 'receipts', label: '🧾 Receipts' },
  { id: 'statements', label: '📊 Statements' },
  { id: 'business', label: '💼 Business' },
  { id: 'dividends', label: '💵 Dividends' },
  { id: 'investments', label: '🏘️ Investments' },
  { id: 'expenses', label: '🧮 Expenses' },
  { id: 'delivery-notes', label: '📄 Delivery Notes' },
  { id: 'reports', label: '📈 Reports' },
  { id: 'share-settings', label: '⚙️ Share Settings' },
  { id: 'leaders', label: '🏛️ Leaders' },
  { id: 'club-profile', label: '🏢 Club Profile' }
];

export default function LeadersPage() {
  const [leaders, setLeaders] = useState([]);
  const [cardDefaults, setCardDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [credentialModal, setCredentialModal] = useState(null);

  const emptyForm = {
    role: 'president', name: '', contact: '', email: '', photo: '', signature: '',
    order: 0, active: true, notes: '', username: '', cardAccess: []
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [l, d] = await Promise.all([
        apiFetch('/api/leaders').then(r => r.json()),
        apiFetch('/api/leaders/card-defaults').then(r => r.json()).catch(() => ({ defaults: {} }))
      ]);
      setLeaders(Array.isArray(l) ? l : []);
      setCardDefaults(d.defaults || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const roleChanged = (role) => {
    setForm(f => ({ ...f, role, cardAccess: cardDefaults[role] || [] }));
  };

  const openAdd = () => {
    setForm({ ...emptyForm, cardAccess: cardDefaults[emptyForm.role] || [] });
    setEditing(null); setMsg(''); setShowAdd(true);
  };

  const openEdit = (leader) => {
    setForm({
      role: leader.role, name: leader.name || '', contact: leader.contact || '',
      email: leader.email || '', photo: leader.photo || '', signature: leader.signature || '',
      order: leader.order || 0, active: leader.active !== false,
      notes: leader.notes || '', username: leader.username || '',
      cardAccess: leader.cardAccess || []
    });
    setEditing(leader._id); setMsg(''); setShowAdd(true);
  };

  const submit = async () => {
    setMsg('');
    if (!form.name.trim()) return setMsg('❌ Name is required');
    if (!form.contact.trim()) return setMsg('❌ Contact is required');

    try {
      const url = editing ? `/api/leaders/${editing}` : '/api/leaders';
      const method = editing ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ ...form, createdBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) {
        if (!editing && d.credentials) {
          setCredentialModal({
            name: form.name, role: form.role,
            username: d.credentials.username, password: d.credentials.password
          });
        } else {
          setMsg('✅ Saved');
          setTimeout(() => setShowAdd(false), 800);
        }
        fetchAll();
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  const resetPassword = async (leader) => {
    if (!confirm(`Reset password for ${leader.name}?`)) return;
    try {
      const res = await apiFetch(`/api/leaders/${leader._id}/reset-password`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        setCredentialModal({
          name: leader.name, role: leader.role,
          username: d.credentials.username, password: d.credentials.password, isReset: true
        });
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('Network error'); }
  };

  const toggleActive = async (leader) => {
    try {
      const res = await apiFetch(`/api/leaders/${leader._id}`, {
        method: 'PUT', body: JSON.stringify({ active: !leader.active })
      });
      if (res.ok) fetchAll();
    } catch (err) { alert('Network error'); }
  };

  const deleteLeader = async (leader) => {
    if (!confirm(`⚠️ Permanently DELETE ${leader.name}?`)) return;
    if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
    try {
      const res = await apiFetch(`/api/leaders/${leader._id}`, { method: 'DELETE' });
      if (res.ok) fetchAll();
    } catch (err) { alert('Network error'); }
  };

  const moveUp = async (idx) => {
    if (idx === 0) return;
    const list = [...leaders];
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    try {
      const res = await apiFetch('/api/leaders/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: list.map((l, i) => ({ id: l._id, order: i + 1 })) })
      });
      if (res.ok) fetchAll();
    } catch (err) { alert('Network error'); }
  };

  const moveDown = async (idx) => {
    if (idx === leaders.length - 1) return;
    const list = [...leaders];
    [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]];
    try {
      const res = await apiFetch('/api/leaders/reorder', {
        method: 'POST',
        body: JSON.stringify({ order: list.map((l, i) => ({ id: l._id, order: i + 1 })) })
      });
      if (res.ok) fetchAll();
    } catch (err) { alert('Network error'); }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) return alert('Image too large — max 500KB');
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, [field]: reader.result }));
    reader.readAsDataURL(file);
  };

  const toggleCard = (cardId) => {
    setForm(f => {
      const has = f.cardAccess.includes(cardId);
      return { ...f, cardAccess: has ? f.cardAccess.filter(c => c !== cardId) : [...f.cardAccess, cardId] };
    });
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading leaders...</div>;

  const filtered = leaders.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.role?.toLowerCase().includes(q) || l.contact?.includes(q);
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>🏛️ Leaders Management</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '13px' }}>Manage club leadership. Issue logins and control card access.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/dashboard" style={btnSecondary}>← Dashboard</a>
          <button onClick={openAdd} style={btn('#2563eb')}>➕ Add Leader</button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...input, maxWidth: '400px' }} />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>{search ? 'No leaders match.' : 'No leaders yet.'}</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Order</th><th style={th}>Photo</th><th style={th}>Role</th>
                <th style={th}>Name</th><th style={th}>Contact</th><th style={th}>Login</th>
                <th style={th}>Cards</th><th style={th}>Status</th><th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, idx) => (
                <tr key={l._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ ...btnMini(idx === 0 ? '#cbd5e1' : '#6b7280'), padding: '2px 6px' }}>▲</button>
                      <button onClick={() => moveDown(idx)} disabled={idx === filtered.length - 1} style={{ ...btnMini(idx === filtered.length - 1 ? '#cbd5e1' : '#6b7280'), padding: '2px 6px' }}>▼</button>
                    </div>
                  </td>
                  <td style={td}>
                    {l.photo ? <img src={l.photo} alt={l.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> :
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>}
                  </td>
                  <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{roleLabel(l.role)}</td>
                  <td style={td}>{l.name}</td>
                  <td style={td}>
                    <div style={{ fontSize: '12px' }}>{l.contact}</div>
                    {l.email && <div style={{ fontSize: '11px', color: '#64748b' }}>{l.email}</div>}
                  </td>
                  <td style={td}>
                    {l.username ? (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{l.username}</div>
                        <button onClick={() => resetPassword(l)} style={btnMini('#f59e0b')}>🔑 Reset</button>
                      </div>
                    ) : <span style={{ fontSize: '11px', color: '#94a3b8' }}>No login</span>}
                  </td>
                  <td style={td}><span style={{ fontSize: '11px', color: '#64748b' }}>{(l.cardAccess || []).length} cards</span></td>
                  <td style={td}>
                    <button onClick={() => toggleActive(l)} style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: l.active ? '#dcfce7' : '#fee2e2', color: l.active ? '#065f46' : '#991b1b', border: 'none', cursor: 'pointer' }}>
                      {l.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(l)} style={btnMini('#3b82f6')}>✏️ Edit</button>
                      <button onClick={() => deleteLeader(l)} style={btnMini('#dc2626')}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title={editing ? '✏️ Edit Leader' : '➕ Add New Leader'} wide>
          {msg && (
            <div style={{ padding: '10px', borderRadius: '8px', marginBottom: '14px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontSize: '13px', fontWeight: '600' }}>{msg}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Role *">
              <select value={form.role} onChange={e => roleChanged(e.target.value)} style={input}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Order"><input type="number" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} style={input} /></Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Full Name *"><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} /></Field>
            <Field label="Contact (Phone) *"><input type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} style={input} /></Field>
          </div>

          <Field label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} /></Field>

          {!editing && (
            <Field label="Username (leave blank to auto-generate)">
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} style={input} placeholder="e.g., president001" />
            </Field>
          )}

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#334155' }}>🎯 Card Access</h4>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px 0' }}>Pre-filled based on role. Admin can customize.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {ALL_CARDS.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', padding: '4px', borderRadius: '4px', background: form.cardAccess.includes(c.id) ? '#dcfce7' : '#fff' }}>
                  <input type="checkbox" checked={form.cardAccess.includes(c.id)} onChange={() => toggleCard(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Photo (max 500KB)">
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'photo')} style={input} />
              {form.photo && <img src={form.photo} alt="photo" style={{ marginTop: '6px', maxHeight: '70px', borderRadius: '6px' }} />}
            </Field>
            <Field label="Signature (max 500KB)">
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'signature')} style={input} />
              {form.signature && <img src={form.signature} alt="signature" style={{ marginTop: '6px', maxHeight: '70px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }} />}
            </Field>
          </div>

          <Field label="Notes"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={input} /></Field>

          <Field label="Status">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </Field>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={submit} style={btn('#2563eb')}>{editing ? 'Save Changes' : 'Create Leader'}</button>
            <button onClick={() => setShowAdd(false)} style={btn('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}

      {credentialModal && (
        <Modal onClose={() => { setCredentialModal(null); setShowAdd(false); }} title="🔑 Login Credentials">
          <div style={{ background: '#fef9e7', border: '1px solid #fcd34d', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#92400e', fontWeight: '600' }}>⚠️ Save these now — password will NOT be shown again</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <CredRow label="Leader" value={credentialModal.name} />
            <CredRow label="Role" value={roleLabel(credentialModal.role)} />
            <CredRow label="Username" value={credentialModal.username} />
            <CredRow label="Password" value={credentialModal.password} highlight />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => {
              navigator.clipboard.writeText(`CRESTED SS INVESTMENT CLUB\nLogin: http://localhost:3000/login\nUsername: ${credentialModal.username}\nPassword: ${credentialModal.password}\nRole: ${roleLabel(credentialModal.role)}\n\nPlease change your password on first login.`);
              alert('✅ Copied');
            }} style={btn('#0891b2')}>📋 Copy for WhatsApp</button>
            <button onClick={() => { setCredentialModal(null); setShowAdd(false); }} style={btn('#6b7280')}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function roleLabel(role) {
  const r = ROLES.find(x => x.value === role);
  return r ? r.label : (role || '').replace(/_/g, ' ');
}

const CredRow = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
    <span style={{ fontSize: '14px', fontWeight: '700', fontFamily: highlight ? 'monospace' : 'inherit', color: highlight ? '#dc2626' : '#0f3460' }}>{value}</span>
  </div>
);

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
const btnSecondary = { padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', display: 'inline-block' };
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' });
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };