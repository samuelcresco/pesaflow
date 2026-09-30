'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API } from '../api-client';

const CLUB_CATEGORIES = [
  'rent', 'utilities', 'transport', 'supplies', 'salaries',
  'marketing', 'maintenance', 'printing', 'staff_welfare', 'meetings', 'other'
];

const BUSINESS_CATEGORIES = [
  'transport', 'fuel', 'supplies', 'rent', 'salaries',
  'utilities', 'maintenance', 'marketing', 'licensing', 'other'
];

export default function ExpensesPage() {
  const [tab, setTab] = useState('club');
  const [loading, setLoading] = useState(true);

  const [clubExpenses, setClubExpenses] = useState([]);
  const [clubTotals, setClubTotals] = useState({ byCategory: [], grandTotal: 0 });

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [businessExpenses, setBusinessExpenses] = useState([]);
  const [businessTotals, setBusinessTotals] = useState({ byCategory: [], grandTotal: 0 });

  const [vouchers, setVouchers] = useState([]);
  const [voucherFilter, setVoucherFilter] = useState('all');

  const [showSingle, setShowSingle] = useState(false);
  const [showMulti, setShowMulti] = useState(false);

  const [singleForm, setSingleForm] = useState({
    description: '', amount: '', category: 'rent', payee: '', cashier: '',
    date: new Date().toISOString().split('T')[0], receiptImage: ''
  });

  const [multiItems, setMultiItems] = useState([{ description: '', amount: '', category: 'rent' }]);
  const [multiMeta, setMultiMeta] = useState({
    payee: '', cashier: '', date: new Date().toISOString().split('T')[0], notes: '', receiptImage: ''
  });

  const [msg, setMsg] = useState('');

  useEffect(() => { fetchClubExpenses(); fetchBusinesses(); fetchVouchers(); }, []);
  useEffect(() => { if (selectedBusiness) fetchBusinessExpenses(); }, [selectedBusiness]);
  useEffect(() => { fetchVouchers(); }, [voucherFilter]);

  const fetchClubExpenses = async () => {
    try {
      const [e, t] = await Promise.all([
        apiFetch('/api/expenses').then(r => r.json()),
        apiFetch('/api/expenses/category-totals').then(r => r.json())
      ]);
      setClubExpenses(e.expenses || []);
      setClubTotals(t);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchBusinesses = async () => {
    try {
      const res = await apiFetch('/api/business');
      const data = await res.json();
      const list = Array.isArray(data) ? data.filter(b => !b.isSystem) : [];
      setBusinesses(list);
      if (list.length > 0 && !selectedBusiness) setSelectedBusiness(list[0]._id);
    } catch (err) { console.error(err); }
  };

  const fetchBusinessExpenses = async () => {
    try {
      const res = await apiFetch(`/api/business/${selectedBusiness}`);
      const data = await res.json();
      const exps = (data.transactions || []).filter(t => t.type === 'expense');
      setBusinessExpenses(exps);

      const totals = {};
      let grand = 0;
      for (const e of exps) {
        const cat = e.category || 'other';
        totals[cat] = (totals[cat] || 0) + Number(e.amount || 0);
        grand += Number(e.amount || 0);
      }
      setBusinessTotals({
        byCategory: Object.entries(totals).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        grandTotal: grand
      });
    } catch (err) { console.error(err); }
  };

  const fetchVouchers = async () => {
    try {
      const params = new URLSearchParams();
      if (voucherFilter !== 'all') params.append('voucherFor', voucherFilter);
      const res = await apiFetch(`/api/expenses/vouchers?${params.toString()}`);
      const data = await res.json();
      setVouchers(data.vouchers || []);
    } catch (err) { console.error(err); }
  };

  const submitSingle = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      if (tab === 'business') {
        const res = await apiFetch('/api/business/record-transaction', {
          method: 'POST',
          body: JSON.stringify({
            businessId: selectedBusiness,
            type: 'expense',
            amount: parseFloat(singleForm.amount),
            description: singleForm.description,
            category: singleForm.category,
            payee: singleForm.payee,
            cashier: singleForm.cashier,
            receiptImage: singleForm.receiptImage,
            date: singleForm.date
          })
        });
        const d = await res.json();
        if (res.ok) {
          setMsg('✅ Business expense recorded');
          setShowSingle(false);
          resetSingleForm();
          fetchBusinessExpenses();
        } else setMsg('❌ ' + (d.error || 'Failed'));
      } else {
        const res = await apiFetch('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({ ...singleForm, amount: parseFloat(singleForm.amount) })
        });
        const d = await res.json();
        if (res.ok) {
          setMsg(`✅ Recorded${d.voucher ? ` — voucher ${d.voucher.voucherNumber}` : ''}`);
          setShowSingle(false);
          resetSingleForm();
          fetchClubExpenses();
          fetchVouchers();
        } else setMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch (err) { setMsg('❌ Network error'); }
  };

  const submitMulti = async () => {
    setMsg('');
    const valid = multiItems.filter(i => i.description && Number(i.amount) > 0);
    if (valid.length === 0) return setMsg('❌ Add at least one item with description and amount');

    try {
      if (tab === 'business') {
        let successCount = 0;
        for (const item of valid) {
          const res = await apiFetch('/api/business/record-transaction', {
            method: 'POST',
            body: JSON.stringify({
              businessId: selectedBusiness,
              type: 'expense',
              amount: parseFloat(item.amount),
              description: item.description,
              category: item.category,
              payee: multiMeta.payee,
              cashier: multiMeta.cashier,
              date: multiMeta.date
            })
          });
          if (res.ok) successCount++;
        }
        setMsg(`✅ ${successCount} business expense(s) recorded`);
        setShowMulti(false);
        resetMultiForm();
        fetchBusinessExpenses();
      } else {
        const res = await apiFetch('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({
            items: valid.map(i => ({ ...i, amount: parseFloat(i.amount) })),
            payee: multiMeta.payee,
            cashier: multiMeta.cashier,
            date: multiMeta.date,
            notes: multiMeta.notes,
            receiptImage: multiMeta.receiptImage
          })
        });
        const d = await res.json();
        if (res.ok) {
          setMsg(`✅ ${d.message || 'Recorded'}${d.voucher ? ` — voucher ${d.voucher.voucherNumber}` : ''}`);
          setShowMulti(false);
          resetMultiForm();
          fetchClubExpenses();
          fetchVouchers();
        } else setMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch (err) { setMsg('❌ Network error'); }
  };

  const resetSingleForm = () => setSingleForm({
    description: '', amount: '', category: 'rent', payee: '', cashier: '',
    date: new Date().toISOString().split('T')[0], receiptImage: ''
  });

  const resetMultiForm = () => {
    setMultiItems([{ description: '', amount: '', category: 'rent' }]);
    setMultiMeta({ payee: '', cashier: '', date: new Date().toISOString().split('T')[0], notes: '', receiptImage: '' });
  };

  const deleteExpense = async (id, description, amount) => {
    if (!confirm(`⚠️ DELETE expense "${description}" (UGX ${Number(amount).toLocaleString()})?\n\nThis will reverse the journal and restore Club Capital.`)) return;
    const reason = prompt('Reason for deletion:');
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/expenses/club/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason, deletedBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + d.message);
        fetchClubExpenses();
        fetchVouchers();
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('Network error'); }
  };

  const deleteVoucher = async (id, voucherNumber) => {
    if (!confirm(`⚠️ Delete voucher ${voucherNumber}?`)) return;
    const reason = prompt('Reason for deletion:');
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/expenses/vouchers/${id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ reason, deletedBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + d.message);
        fetchVouchers();
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('Network error'); }
  };

  const updateMultiItem = (idx, field, value) => {
    const updated = [...multiItems];
    updated[idx][field] = value;
    setMultiItems(updated);
  };

  const addMultiRow = () => setMultiItems([...multiItems, { description: '', amount: '', category: 'rent' }]);
  const removeMultiRow = (idx) => setMultiItems(multiItems.filter((_, i) => i !== idx));

  const handleImageUpload = (e, setter, form) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Image too large — max 2MB');
    const reader = new FileReader();
    reader.onload = () => setter({ ...form, receiptImage: reader.result });
    reader.readAsDataURL(file);
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  const categories = tab === 'business' ? BUSINESS_CATEGORIES : CLUB_CATEGORIES;
  const currentTotals = tab === 'business' ? businessTotals : clubTotals;
  const currentExpenses = tab === 'business' ? businessExpenses : clubExpenses;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>💸 Expenses</h1>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px' }}>
        <TabBtn active={tab === 'club'} onClick={() => setTab('club')}>🏛️ Club Expenses</TabBtn>
        <TabBtn active={tab === 'business'} onClick={() => setTab('business')}>💼 Business Expenses</TabBtn>
        <TabBtn active={tab === 'vouchers'} onClick={() => setTab('vouchers')}>🧾 Vouchers</TabBtn>
      </div>

      {tab === 'business' && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginRight: '8px' }}>Business:</label>
          <select value={selectedBusiness} onChange={e => setSelectedBusiness(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minWidth: '250px' }}>
            {businesses.length === 0 ? <option value="">No businesses</option> : businesses.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {(tab === 'club' || tab === 'business') && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => { setShowSingle(true); setMsg(''); }} style={btn('#2563eb')}>➕ Add Expense</button>
          <button onClick={() => { setShowMulti(true); setMsg(''); }} style={btn('#7c3aed')}>➕ Add Multiple</button>
        </div>
      )}

      {msg && <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600' }}>{msg}</div>}

      {(tab === 'club' || tab === 'business') && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <SummaryCard title="Total Spent" value={currentTotals.grandTotal || 0} color="#dc2626" bg="#fee2e2" icon="💸" />
            <SummaryCard title="Categories" value={currentTotals.byCategory?.length || 0} color="#0369a1" bg="#e0f2fe" icon="📊" raw />
            <SummaryCard title="Transactions" value={currentExpenses.length} color="#475569" bg="#f1f5f9" icon="🔢" raw />
          </div>

          {(currentTotals.byCategory || []).length > 0 && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', textTransform: 'uppercase' }}>Category Totals</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {currentTotals.byCategory.map(c => {
                  const pct = currentTotals.grandTotal > 0 ? ((c.total / currentTotals.grandTotal) * 100).toFixed(1) : 0;
                  return (
                    <div key={c.category} style={{ background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>{c.category.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#dc2626', marginTop: '2px' }}>UGX {c.total.toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{pct}% of total</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentExpenses.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No expenses recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={th}>Date</th><th style={th}>Description</th><th style={th}>Category</th>
                    <th style={th}>Payee</th><th style={th}>Cashier</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentExpenses.map((e, i) => (
                    <tr key={e._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={td}>{new Date(e.date).toLocaleDateString()}</td>
                      <td style={td}>{e.description}</td>
                      <td style={{ ...td, textTransform: 'capitalize' }}>{(e.category || 'other').replace(/_/g, ' ')}</td>
                      <td style={td}>{e.payee || e.paidTo || '—'}</td>
                      <td style={td}>{e.cashier || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>UGX {Number(e.amount || 0).toLocaleString()}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                          {e.receiptImage ? <a href={e.receiptImage} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: '#0891b2', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '11px' }}>📎</a> : null}
                          {tab === 'club' && <button onClick={() => deleteExpense(e._id, e.description, e.amount)} style={{ padding: '5px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>🗑 Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'vouchers' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <select value={voucherFilter} onChange={e => setVoucherFilter(e.target.value)} style={input}>
              <option value="all">All Vouchers</option>
              <option value="club">Club Vouchers</option>
              <option value="business">Business Vouchers</option>
            </select>
          </div>

          {vouchers.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No vouchers yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={th}>Voucher #</th><th style={th}>Date</th><th style={th}>For</th>
                    <th style={th}>Payee</th><th style={th}>Cashier</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Status</th><th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v, i) => (
                    <tr key={v._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{v.voucherNumber}</td>
                      <td style={td}>{new Date(v.date).toLocaleDateString()}</td>
                      <td style={{ ...td, textTransform: 'capitalize' }}>{v.voucherFor}</td>
                      <td style={td}>{v.payee}</td>
                      <td style={td}>{v.cashier || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: '700' }}>UGX {Number(v.totalAmount || 0).toLocaleString()}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: v.status === 'issued' ? '#dcfce7' : '#fee2e2', color: v.status === 'issued' ? '#065f46' : '#991b1b' }}>{v.status}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                          <a href={`${API}/api/expenses/vouchers/${v._id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '11px' }}>📄</a>
                          <button onClick={() => deleteVoucher(v._id, v.voucherNumber)} style={{ padding: '5px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>🗑 Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showSingle && (
        <Modal onClose={() => setShowSingle(false)} title={`Add ${tab === 'business' ? 'Business' : 'Club'} Expense`}>
          <form onSubmit={submitSingle}>
            <Field label="Description *"><input type="text" value={singleForm.description} onChange={e => setSingleForm({ ...singleForm, description: e.target.value })} required style={input} placeholder="e.g., Water bill for September" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Amount (UGX) *"><input type="number" value={singleForm.amount} onChange={e => setSingleForm({ ...singleForm, amount: e.target.value })} required style={input} /></Field>
              <Field label="Category *">
                <select value={singleForm.category} onChange={e => setSingleForm({ ...singleForm, category: e.target.value })} style={input}>
                  {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Payee"><input type="text" value={singleForm.payee} onChange={e => setSingleForm({ ...singleForm, payee: e.target.value })} style={input} placeholder="e.g., NWSC" /></Field>
              <Field label="Cashier"><input type="text" value={singleForm.cashier} onChange={e => setSingleForm({ ...singleForm, cashier: e.target.value })} style={input} placeholder="e.g., Treasurer" /></Field>
            </div>
            <Field label="Date *"><input type="date" value={singleForm.date} onChange={e => setSingleForm({ ...singleForm, date: e.target.value })} required style={input} /></Field>
            <Field label="Attach Vendor Receipt (optional)">
              <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setSingleForm, singleForm)} style={input} />
              {singleForm.receiptImage && <img src={singleForm.receiptImage} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '120px', marginTop: '6px', borderRadius: '6px' }} />}
            </Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" style={btn('#2563eb')}>Save</button>
              <button type="button" onClick={() => setShowSingle(false)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showMulti && (
        <Modal onClose={() => setShowMulti(false)} title={`Add Multiple ${tab === 'business' ? 'Business' : 'Club'} Expenses`} wide>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <Field label="Payee"><input type="text" value={multiMeta.payee} onChange={e => setMultiMeta({ ...multiMeta, payee: e.target.value })} style={input} /></Field>
              <Field label="Cashier"><input type="text" value={multiMeta.cashier} onChange={e => setMultiMeta({ ...multiMeta, cashier: e.target.value })} style={input} /></Field>
              <Field label="Date"><input type="date" value={multiMeta.date} onChange={e => setMultiMeta({ ...multiMeta, date: e.target.value })} style={input} /></Field>
            </div>
          </div>

          <h4 style={{ margin: '12px 0 8px 0', fontSize: '13px', color: '#334155' }}>Items</h4>
          {multiItems.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1.5fr auto', gap: '8px', marginBottom: '8px', alignItems: 'end' }}>
              <input type="text" value={item.description} onChange={e => updateMultiItem(idx, 'description', e.target.value)} placeholder="Description" style={input} />
              <input type="number" value={item.amount} onChange={e => updateMultiItem(idx, 'amount', e.target.value)} placeholder="Amount" style={input} />
              <select value={item.category} onChange={e => updateMultiItem(idx, 'category', e.target.value)} style={input}>
                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              {multiItems.length > 1 && <button type="button" onClick={() => removeMultiRow(idx)} style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
            </div>
          ))}

          <button type="button" onClick={addMultiRow} style={{ padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>➕ Add Row</button>

          <Field label="Notes"><input type="text" value={multiMeta.notes} onChange={e => setMultiMeta({ ...multiMeta, notes: e.target.value })} style={{ ...input, marginTop: '12px' }} placeholder="Optional notes" /></Field>

          <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
            <span>TOTAL</span>
            <span>UGX {multiItems.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button type="button" onClick={submitMulti} style={btn('#2563eb')}>Save All</button>
            <button type="button" onClick={() => setShowMulti(false)} style={btn('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const TabBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: active ? '3px solid #2563eb' : '3px solid transparent', color: active ? '#1e293b' : '#64748b', fontWeight: active ? '600' : '500', cursor: 'pointer', marginBottom: '-2px', fontSize: '14px' }}>{children}</button>
);

const SummaryCard = ({ title, value, color, bg, icon, raw }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '12px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color }}>{raw ? value : `UGX ${(value || 0).toLocaleString()}`}</div>
    </div>
    <span style={{ fontSize: '22px' }}>{icon}</span>
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

const btn = (bg) => ({ padding: '10px 20px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' });
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };