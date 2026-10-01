'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../api-client';

const API = 'https://pesaflow-api-jpll.onrender.com';

export default function MultiEntryPage() {
  const [members, setMembers] = useState([]);
  const [sharePrices, setSharePrices] = useState({});
  const [agreedSavings, setAgreedSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState(null);

  const [form, setForm] = useState({
    memberId: '', date: new Date().toISOString().split('T')[0], notes: '',
    monthly: '', extra: '', misc: '', donation: '', donationType: 'member',
    penalty: '', penaltyDescription: 'Late Coming', membership: '', membershipType: 'first_time',
    golden: 0, platinum: 0, silver: 0, bronze: 0
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [mem, settings, agreed] = await Promise.all([
        apiFetch('/api/members').then(r => r.json()),
        apiFetch('/api/settings/shares').then(r => r.json()).catch(() => ({})),
        apiFetch('/api/savings/agreed-savings').then(r => r.json()).catch(() => [])
      ]);
      setMembers(Array.isArray(mem) ? mem : []);
      if (settings.shareTypes) setSharePrices(settings.shareTypes);
      setAgreedSavings(Array.isArray(agreed) ? agreed : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const currentYear = new Date(form.date).getFullYear();
  const yearSetting = agreedSavings.find(a => a.year === currentYear);

  const num = (v) => Number(v) || 0;
  const lineTotal = (v) => num(v);
  const shareValue = (type) => (sharePrices[type]?.price || 0) * num(form[type]);

  const grandTotal =
    lineTotal(form.monthly) + lineTotal(form.extra) + lineTotal(form.misc) +
    lineTotal(form.donation) + lineTotal(form.penalty) + lineTotal(form.membership) +
    shareValue('golden') + shareValue('platinum') + shareValue('silver') + shareValue('bronze');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setLastReceiptId(null);

    if (!form.memberId) return setMsg('❌ Select a member');
    if (grandTotal <= 0) return setMsg('❌ Grand total is 0 — enter at least one amount');

    const items = [];
    if (num(form.monthly) > 0) items.push({ category: 'monthly', amount: num(form.monthly), description: 'Monthly Contribution' });
    if (num(form.extra) > 0) items.push({ category: 'extra', amount: num(form.extra), description: 'Personal Savings' });
    if (num(form.misc) > 0) items.push({ category: 'misc', amount: num(form.misc), description: 'Miscellaneous' });
    if (num(form.donation) > 0) items.push({ category: 'donation', amount: num(form.donation), donationType: form.donationType, description: form.donationType === 'external' ? 'External Donation' : 'Member Donation' });
    if (num(form.penalty) > 0) items.push({ category: 'penalty', amount: num(form.penalty), description: form.penaltyDescription });
    if (num(form.membership) > 0) items.push({ category: 'membership', amount: num(form.membership), membershipType: form.membershipType, description: 'Membership' });

    const shareQty = { golden: num(form.golden), platinum: num(form.platinum), silver: num(form.silver), bronze: num(form.bronze) };
    for (const [type, qty] of Object.entries(shareQty)) {
      if (qty > 0) {
        const amount = (sharePrices[type]?.price || 0) * qty;
        items.push({ category: 'shares', shareType: type, shareQuantity: qty, amount, description: 'Share Purchase' });
      }
    }

    if (items.length === 0) return setMsg('❌ No valid items');

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/receipts/multi-item', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId, date: form.date, notes: form.notes,
          items, issuedBy: 'admin'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Receipt ${data.receipt.receiptNumber} created — ${items.length} items, total UGX ${num(data.grandTotal).toLocaleString()}`);
        setLastReceiptId(data.receipt._id);
        setForm({
          ...form, monthly: '', extra: '', misc: '', donation: '', penalty: '', membership: '',
          golden: 0, platinum: 0, silver: 0, bronze: 0, notes: ''
        });
      } else {
        setMsg('❌ ' + (data.error || 'Failed'));
      }
    } catch (err) { setMsg('❌ Network error'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>🧾 Record Multiple Transactions</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Fill in only what the member is paying. Empty fields are ignored. One receipt will combine all items.</p>

      {msg && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '20px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600' }}>{msg}</div>
      )}

      <form onSubmit={submit} style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>

        <Section title="Member & Date">
          <Field label="Member *">
            <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} required style={input}>
              <option value="">Select Member</option>
              {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required style={input} />
          </Field>
        </Section>

        <Section title="Savings">
          <Field label={`Monthly Savings${yearSetting ? ` (agreed: ${num(yearSetting.amount).toLocaleString()})` : ''}`}>
            <input type="number" value={form.monthly} onChange={e => setForm({ ...form, monthly: e.target.value })} style={input} placeholder="0" />
          </Field>
          <Field label="Extra Savings">
            <input type="number" value={form.extra} onChange={e => setForm({ ...form, extra: e.target.value })} style={input} placeholder="0" />
          </Field>
          <Field label="Miscellaneous">
            <input type="number" value={form.misc} onChange={e => setForm({ ...form, misc: e.target.value })} style={input} placeholder="0" />
          </Field>
        </Section>

        <Section title="Donation">
          <Field label="Donation Type">
            <select value={form.donationType} onChange={e => setForm({ ...form, donationType: e.target.value })} style={input}>
              <option value="member">Member Donation</option>
              <option value="external">External Donation</option>
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" value={form.donation} onChange={e => setForm({ ...form, donation: e.target.value })} style={input} placeholder="0" />
          </Field>
        </Section>

        <Section title="Penalty">
          <Field label="Reason">
            <select value={form.penaltyDescription} onChange={e => setForm({ ...form, penaltyDescription: e.target.value })} style={input}>
              <option value="Late Coming">Late Coming</option>
              <option value="Late Payment">Late Payment</option>
              <option value="Misconduct">Misconduct</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" value={form.penalty} onChange={e => setForm({ ...form, penalty: e.target.value })} style={input} placeholder="0" />
          </Field>
        </Section>

        <Section title="Membership">
          <Field label="Type">
            <select value={form.membershipType} onChange={e => setForm({ ...form, membershipType: e.target.value })} style={input}>
              <option value="first_time">First-time</option>
              <option value="renewal">Renewal</option>
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" value={form.membership} onChange={e => setForm({ ...form, membership: e.target.value })} style={input} placeholder="0" />
          </Field>
        </Section>

        <Section title="Shares">
          {['golden', 'platinum', 'silver', 'bronze'].map(type => (
            <Field key={type} label={`${type.charAt(0).toUpperCase() + type.slice(1)} — UGX ${(sharePrices[type]?.price || 0).toLocaleString()} each`}>
              <input type="number" min="0" value={form[type]} onChange={e => setForm({ ...form, [type]: parseInt(e.target.value) || 0 })} style={input} placeholder="0" />
              {num(form[type]) > 0 && <small style={{ color: '#15803d', fontWeight: '600' }}>= UGX {shareValue(type).toLocaleString()}</small>}
            </Field>
          ))}
        </Section>

        <Section title="Notes">
          <Field label="Optional notes for this receipt">
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={input} placeholder="e.g., monthly + shares for Sept" />
          </Field>
        </Section>

        <div style={{ background: '#0f3460', color: '#fff', padding: '16px 20px', borderRadius: '10px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: '600' }}>GRAND TOTAL</span>
          <span style={{ fontSize: '24px', fontWeight: '700' }}>UGX {grandTotal.toLocaleString()}</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button type="submit" disabled={submitting} style={{ padding: '12px 24px', background: submitting ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
            {submitting ? 'Saving...' : '💾 Save All & Generate Receipt'}
          </button>
          {lastReceiptId && (
            <a href={`${API}/api/receipts/${lastReceiptId}/pdf`} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>🧾 View Receipt PDF</a>
          )}
          <a href="/savings" style={{ padding: '12px 24px', background: '#6b7280', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>← Back to Savings</a>
        </div>
      </form>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
    <h3 style={{ margin: '0 0 12px 0', color: '#0f3460', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>{children}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '8px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155', fontSize: '13px' }}>{label}</label>
    {children}
  </div>
);

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };