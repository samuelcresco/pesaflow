'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, API } from '../../api-client';

export default function BusinessDetailPage() {
  const params = useParams();
  const businessId = params?.id;

  const [business, setBusiness] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => { if (businessId) fetchBusiness(); }, [businessId]);

  const fetchBusiness = async () => {
    try {
      const res = await apiFetch(`/api/business/${businessId}`);
      const data = await res.json();
      if (data.business) {
        setBusiness(data.business);
        setSummary(data.summary);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;
  if (!business) return <div style={{ padding: '40px' }}>Business not found.</div>;

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'products', label: '📦 Products' },
    { id: 'sales', label: '🧾 Sales' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1e293b' }}>💼 {business.name}</h1>
          {business.description && <p style={{ color: '#64748b', marginTop: '4px' }}>{business.description}</p>}
        </div>
        <a href="/business" style={btnSecondary}>← All Businesses</a>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 18px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '3px solid #2563eb' : '3px solid transparent',
              color: tab === t.id ? '#1e293b' : '#64748b',
              fontWeight: tab === t.id ? '600' : '500',
              cursor: 'pointer', marginBottom: '-2px', fontSize: '14px'
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab business={business} summary={summary} />}
      {tab === 'products' && <ProductsTab businessId={businessId} />}
      {tab === 'sales' && <SalesTab businessId={businessId} businessName={business.name} />}
      {tab === 'settings' && <SettingsTab business={business} onUpdate={fetchBusiness} />}
    </div>
  );
}

// ==================== OVERVIEW ====================
function OverviewTab({ business, summary }) {
  const [poolStatus, setPoolStatus] = useState(null);
  const [showDeclare, setShowDeclare] = useState(false);
  const [declareAmount, setDeclareAmount] = useState('');
  const [declareNotes, setDeclareNotes] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchPool(); }, [business._id]);

  const fetchPool = async () => {
    try {
      const res = await apiFetch('/api/business/profit-pool/status');
      const data = await res.json();
      setPoolStatus(data);
    } catch (err) { console.error(err); }
  };

  const submitDeclare = async () => {
    setMsg('');
    try {
      const res = await apiFetch('/api/business/profit-pool/declare', {
        method: 'POST',
        body: JSON.stringify({
          businessId: business._id,
          amount: parseFloat(declareAmount),
          notes: declareNotes,
          declaredBy: 'admin'
        })
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ ' + (d.message || 'Declared'));
        setDeclareAmount(''); setDeclareNotes('');
        setShowDeclare(false);
        window.location.reload();
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  const retention = Number(business.minimumRetention) || 0;
  const balance = Number(business.currentBalance) || 0;
  const declarable = Math.max(0, balance - retention);

  return (
    <div>
      {msg && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600' }}>{msg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <Card title="Current Balance" value={balance} color="#0369a1" bg="#e0f2fe" icon="💰" />
        <Card title="Total Declared to Pool" value={business.totalProfitDeclared || 0} color="#7c3aed" bg="#f3e8ff" icon="📈" />
        <Card title="Minimum Retention" value={retention} color="#b45309" bg="#fef9e7" icon="🔒" />
        <Card title="Available to Declare" value={declarable} color="#15803d" bg="#dcfce7" icon="✅" />
      </div>

      {summary && (
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '14px', color: '#334155', textTransform: 'uppercase' }}>Profit & Loss Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <Stat label="Revenue" value={summary.revenue || 0} color="#15803d" />
            <Stat label="Expenses" value={summary.expenses || 0} color="#dc2626" />
            <Stat label="Losses" value={summary.losses || 0} color="#dc2626" />
            <Stat label="Net Profit" value={summary.netProfit || 0} color={summary.netProfit >= 0 ? '#15803d' : '#dc2626'} />
          </div>
        </div>
      )}

      {declarable > 0 && (
        <div style={{ background: '#fef9e7', border: '1px solid #fcd34d', padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600', color: '#92400e' }}>📤 Declare Profit to Pool</div>
              <div style={{ fontSize: '12px', color: '#78350f', marginTop: '4px' }}>You can declare up to UGX {declarable.toLocaleString()} (keeping UGX {retention.toLocaleString()} retained).</div>
            </div>
            <button onClick={() => setShowDeclare(true)} style={btn('#f59e0b')}>Declare Profit</button>
          </div>
        </div>
      )}

      {showDeclare && (
        <div style={modalBg}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Declare Profit from {business.name}</h3>
            <Field label="Amount (UGX)">
              <input type="number" value={declareAmount} onChange={e => setDeclareAmount(e.target.value)} style={input} placeholder={`Max ${declarable.toLocaleString()}`} />
            </Field>
            <Field label="Notes (optional)">
              <input type="text" value={declareNotes} onChange={e => setDeclareNotes(e.target.value)} style={input} />
            </Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={submitDeclare} style={btn('#f59e0b')}>Confirm</button>
              <button onClick={() => setShowDeclare(false)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PRODUCTS ====================
function ProductsTab({ businessId }) {
  const [products, setProducts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', sku: '', price: '', costPrice: '',
    category: 'other', stock: 0, trackStock: false, lowStockThreshold: 5
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProducts(); }, [businessId]);

  const fetchProducts = async () => {
    try {
      const res = await apiFetch(`/api/business/${businessId}/products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const reset = () => setForm({ name: '', description: '', sku: '', price: '', costPrice: '', category: 'other', stock: 0, trackStock: false, lowStockThreshold: 5 });

  const submit = async () => {
    const url = editing ? `/api/business/products/${editing}` : '/api/business/products/create';
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? form : { ...form, businessId };
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ Saved');
        setShowAdd(false); setEditing(null); reset();
        fetchProducts();
      } else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
  };

  const edit = (p) => {
    setEditing(p._id);
    setForm({
      name: p.name, description: p.description || '', sku: p.sku || '',
      price: p.price, costPrice: p.costPrice || 0, category: p.category || 'other',
      stock: p.stock || 0, trackStock: p.trackStock || false, lowStockThreshold: p.lowStockThreshold || 5
    });
    setShowAdd(true);
  };

  const remove = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      const res = await apiFetch(`/api/business/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
      else alert('Failed');
    } catch (err) { alert('Network error'); }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading products...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>📦 Products ({products.length})</h3>
        <button onClick={() => { setShowAdd(true); setEditing(null); reset(); }} style={btn('#2563eb')}>➕ Add Product</button>
      </div>

      {products.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No products yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Name</th>
                <th style={th}>Category</th>
                <th style={{ ...th, textAlign: 'right' }}>Price</th>
                <th style={{ ...th, textAlign: 'right' }}>Cost</th>
                <th style={{ ...th, textAlign: 'right' }}>Margin</th>
                <th style={th}>Stock</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{p.name}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{p.category}</td>
                  <td style={{ ...td, textAlign: 'right' }}>UGX {Number(p.price || 0).toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>UGX {Number(p.costPrice || 0).toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#15803d', fontWeight: '600' }}>{p.marginPercent || 0}%</td>
                  <td style={td}>
                    {p.trackStock ? (
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px',
                        background: p.stock <= p.lowStockThreshold ? '#fee2e2' : '#dcfce7',
                        color: p.stock <= p.lowStockThreshold ? '#991b1b' : '#065f46',
                        fontWeight: '600'
                      }}>{p.stock} {p.stock <= p.lowStockThreshold && '⚠️'}</span>
                    ) : <span style={{ color: '#94a3b8', fontSize: '11px' }}>Not tracked</span>}
                  </td>
                  <td style={td}>
                    <button onClick={() => edit(p)} style={btnMini('#3b82f6')}>Edit</button>
                    <button onClick={() => remove(p._id)} style={btnMini('#dc2626')}>Delete</button>
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
            <h3 style={{ marginTop: 0 }}>{editing ? 'Edit Product' : 'Add Product'}</h3>
            <Field label="Name *"><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} /></Field>
            <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Price (UGX) *"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={input} /></Field>
              <Field label="Cost Price (UGX)"><input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} style={input} /></Field>
            </div>
            <Field label="Category">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={input}>
                <option value="apparel">Apparel</option>
                <option value="accessories">Accessories</option>
                <option value="food">Food</option>
                <option value="poultry">Poultry</option>
                <option value="services">Services</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Track Stock?">
              <input type="checkbox" checked={form.trackStock} onChange={e => setForm({ ...form, trackStock: e.target.checked })} />
            </Field>
            {form.trackStock && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Current Stock"><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={input} /></Field>
                <Field label="Low Stock Alert At"><input type="number" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} style={input} /></Field>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={submit} style={btn('#2563eb')}>Save</button>
              <button onClick={() => { setShowAdd(false); setEditing(null); reset(); }} style={btn('#6b7280')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SALES ====================
function SalesTab({ businessId, businessName }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    customerName: '', customerContact: '',
    items: [{ productId: '', productName: '', quantity: 1, unitPrice: '' }],
    discount: 0, paymentMethod: 'cash', paymentReference: '',
    amountPaid: '', soldBy: '', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchSales(); fetchProducts(); }, [businessId]);

  const fetchSales = async () => {
    try {
      const res = await apiFetch(`/api/business/${businessId}/sales`);
      const data = await res.json();
      setSales(data.sales || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiFetch(`/api/business/${businessId}/products?active=true`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) { console.error(err); }
  };

  const addItemRow = () => setForm({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, unitPrice: '' }] });

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx][field] = value;
    if (field === 'productId' && value) {
      const p = products.find(x => x._id === value);
      if (p) { items[idx].productName = p.name; items[idx].unitPrice = p.price; }
    }
    setForm({ ...form, items });
  };

  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0));

  const submitSale = async () => {
    setMsg('');
    if (!form.customerName.trim()) return setMsg('❌ Customer name required');
    const validItems = form.items.filter(i => i.productName && Number(i.quantity) > 0 && Number(i.unitPrice) > 0);
    if (validItems.length === 0) return setMsg('❌ Add at least one item');

    try {
      const res = await apiFetch('/api/business/sales/create', {
        method: 'POST',
        body: JSON.stringify({
          businessId,
          customerName: form.customerName,
          customerContact: form.customerContact,
          items: validItems.map(i => ({
            productId: i.productId || null,
            productName: i.productName,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice)
          })),
          discount: Number(form.discount) || 0,
          paymentMethod: form.paymentMethod,
          paymentReference: form.paymentReference,
          amountPaid: form.amountPaid === '' ? undefined : Number(form.amountPaid),
          soldBy: form.soldBy || 'admin',
          date: form.date,
          notes: form.notes
        })
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(`✅ Sale recorded — ${d.sale.receiptNumber}`);
        setTimeout(() => {
          setShowNew(false);
          resetForm();
          fetchSales();
          fetchProducts();
        }, 800);
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  const resetForm = () => setForm({
    customerName: '', customerContact: '',
    items: [{ productId: '', productName: '', quantity: 1, unitPrice: '' }],
    discount: 0, paymentMethod: 'cash', paymentReference: '',
    amountPaid: '', soldBy: '', date: new Date().toISOString().split('T')[0], notes: ''
  });

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.receiptNumber?.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q);
  });

  if (loading) return <div style={{ padding: '20px' }}>Loading sales...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>🧾 Sales ({sales.length})</h3>
        <button onClick={() => { setShowNew(true); setMsg(''); }} style={btn('#15803d')}>➕ New Sale</button>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search receipt # or customer..." style={{ ...input, maxWidth: '400px' }} />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No sales yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Receipt #</th>
                <th style={th}>Date</th>
                <th style={th}>Customer</th>
                <th style={th}>Items</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={th}>Payment</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{s.receiptNumber}</td>
                  <td style={td}>{new Date(s.date).toLocaleDateString()}</td>
                  <td style={td}>{s.customerName}</td>
                  <td style={td}>{s.items?.length || 0}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700' }}>UGX {Number(s.total || 0).toLocaleString()}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{s.paymentMethod.replace(/_/g, ' ')}</td>
                  <td style={td}>
                    <a href={`${API}/api/business/sales/${s._id}/pdf`} target="_blank" rel="noopener noreferrer" style={btnMini('#7c3aed')}>📄 PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div style={modalBg}>
          <div style={{ ...modalBox, width: '800px' }}>
            <h3 style={{ marginTop: 0 }}>New Sale — {businessName}</h3>
            {msg && <div style={{ padding: '10px', borderRadius: '6px', marginBottom: '12px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b' }}>{msg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Customer Name *"><input type="text" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} style={input} /></Field>
              <Field label="Customer Contact"><input type="text" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} style={input} /></Field>
            </div>

            <h4 style={{ marginBottom: '6px', fontSize: '13px', color: '#334155' }}>Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px' }}>
                <select value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} style={input}>
                  <option value="">-- Pick product or type below --</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name} (UGX {p.price.toLocaleString()})</option>)}
                </select>
                <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" style={input} />
                <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} placeholder="Unit Price" style={input} />
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(idx)} style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={addItemRow} style={{ padding: '6px 12px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>➕ Add Item</button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '16px' }}>
              <Field label="Discount (UGX)"><input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} style={input} /></Field>
              <Field label="Payment Method">
                <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} style={input}>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank</option>
                  <option value="credit">Credit</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Payment Reference"><input type="text" value={form.paymentReference} onChange={e => setForm({ ...form, paymentReference: e.target.value })} style={input} /></Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <Field label="Sold By"><input type="text" value={form.soldBy} onChange={e => setForm({ ...form, soldBy: e.target.value })} style={input} /></Field>
              <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={input} /></Field>
              <Field label="Amount Paid (if partial)"><input type="number" value={form.amountPaid} onChange={e => setForm({ ...form, amountPaid: e.target.value })} style={input} placeholder="Leave blank for full payment" /></Field>
            </div>

            <div style={{ background: '#0f3460', color: '#fff', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '15px', fontWeight: '700' }}>
              <span>Subtotal: UGX {subtotal.toLocaleString()}</span>
              <span>TOTAL: UGX {total.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={submitSale} style={btn('#15803d')}>Save & Generate Receipt</button>
              <button onClick={() => { setShowNew(false); resetForm(); }} style={btn('#6b7280')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SETTINGS ====================
function SettingsTab({ business, onUpdate }) {
  const [form, setForm] = useState({
    name: business.name || '',
    description: business.description || '',
    tagline: business.tagline || '',
    contact: business.contact || '',
    email: business.email || '',
    address: business.address || '',
    logo: business.logo || '',
    minimumRetention: business.minimumRetention || 0
  });
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setMsg('');
    try {
      const res = await apiFetch(`/api/business/${business._id}/branding`, {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ Saved');
        onUpdate();
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) return alert('Logo too large — max 500KB');
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {msg && <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600' }}>{msg}</div>}

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', maxWidth: '700px' }}>
        <h3 style={{ marginTop: 0 }}>Business Branding</h3>
        <p style={{ color: '#64748b', fontSize: '13px' }}>These details appear on sale receipts and reports.</p>

        <Field label="Business Name"><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} /></Field>
        <Field label="Tagline"><input type="text" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} style={input} placeholder="e.g., Quality Supplies" /></Field>
        <Field label="Description"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="Contact Phone"><input type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} style={input} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} /></Field>
        </div>
        <Field label="Address"><input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={input} /></Field>
        <Field label="Logo (max 500KB)"><input type="file" accept="image/*" onChange={handleLogo} style={input} /></Field>
        {form.logo && <img src={form.logo} alt="Logo" style={{ maxHeight: '80px', marginBottom: '12px', borderRadius: '6px' }} />}

        <h3 style={{ marginTop: '24px' }}>Profit Retention</h3>
        <p style={{ color: '#64748b', fontSize: '13px' }}>Minimum working capital that must stay in this business. Only profit above this can be declared to the pool.</p>
        <Field label="Minimum Retention (UGX)"><input type="number" value={form.minimumRetention} onChange={e => setForm({ ...form, minimumRetention: e.target.value })} style={input} /></Field>

        <button onClick={submit} style={btn('#2563eb')}>Save Settings</button>
      </div>
    </div>
  );
}

// ==================== SHARED ====================
const Card = ({ title, value, color, bg, icon }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '12px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color }}>UGX {Number(value || 0).toLocaleString()}</div>
    </div>
    <span style={{ fontSize: '22px' }}>{icon}</span>
  </div>
);

const Stat = ({ label, value, color }) => (
  <div style={{ background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: '11px', color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: '15px', fontWeight: '700', color }}>UGX {Number(value || 0).toLocaleString()}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const btn = (bg) => ({ padding: '10px 18px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' });
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', marginRight: '4px', textDecoration: 'none', display: 'inline-block' });
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', padding: '24px', borderRadius: '14px', width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' };