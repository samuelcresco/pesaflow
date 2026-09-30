'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../api-client';

const API = 'http://localhost:5000';

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [summary, setSummary] = useState({ window: { ok: false, period: null }, counts: { pending: 0, approved: 0, paid: 0, rejected: 0 }, totalPaid: 0, windowLabel: '' });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPayModal, setShowPayModal] = useState(null);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Request form
  const [requestForm, setRequestForm] = useState({
    memberId: '',
    source: 'savings',
    amount: '',
    notes: '',
    overrideReason: ''
  });
  const [eligibility, setEligibility] = useState(null);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'cash',
    paymentReference: '',
    paidBy: 'admin'
  });

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchWithdrawals(); }, [statusFilter, sourceFilter]);

  const fetchAll = async () => {
    try {
      const [w, s, mem, st] = await Promise.all([
        apiFetch('/api/withdrawals').then(r => r.json()),
        apiFetch('/api/withdrawals').then(r => r.json()),
        apiFetch('/api/withdrawals/summary').then(r => r.json()),
        apiFetch('/api/members').then(r => r.json())
      ]);
      setWithdrawals(w.withdrawals || []);
      setSummary(s);
      setMembers(Array.isArray(mem) ? mem : []);
      setSettings(st);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchWithdrawals = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      const res = await apiFetch(`/api/withdrawals?${params.toString()}`);
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } catch (err) { console.error(err); }
  };

  const checkEligibility = async (memberId, source) => {
    if (!memberId) { setEligibility(null); return; }
    try {
      const res = await apiFetch(`/api/withdrawals/eligibility/${memberId}?source=${source}&amount=0`);
      const data = await res.json();
      setEligibility(data);
    } catch (err) { setEligibility(null); }
  };

  useEffect(() => {
    if (requestForm.memberId) checkEligibility(requestForm.memberId, requestForm.source);
  }, [requestForm.memberId, requestForm.source]);

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
     const res = await apiFetch('/api/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ ...requestForm, requestedBy: 'admin' })
    });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + d.message);
        setShowRequest(false);
        setRequestForm({ memberId: '', source: 'savings', amount: '', notes: '', overrideReason: '' });
        setEligibility(null);
        fetchAll();
      } else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
  };

  const approve = async (id) => {
    if (!confirm('Approve this withdrawal?')) return;
    try {
      const res = await apiFetch(`/api/withdrawals/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ approvedBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) { alert('✅ Approved'); fetchAll(); }
      else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
  };

  const reject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/withdrawals/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejectedBy: 'admin', reason })
      });
      const d = await res.json();
      if (res.ok) { alert('✅ Rejected'); fetchAll(); }
      else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/withdrawals/${showPayModal}/pay`, {
        method: 'PUT',
        body: JSON.stringify(paymentForm)
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + d.message + (d.receipt ? `\n\nReceipt: ${d.receipt.receiptNumber}` : ''));
        setShowPayModal(null);
        setPaymentForm({ paymentMethod: 'cash', paymentReference: '', paidBy: 'admin' });
        fetchAll();
      } else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`${API}/api/withdrawals/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, updatedBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ Settings saved');
        setShowSettings(false);
        fetchAll();
      } else alert('❌ ' + d.error);
    } catch (err) { alert('Network error'); }
    finally { setSavingSettings(false); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  const { window, counts } = summary;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ color: '#1e293b', margin: 0 }}>💸 Withdrawals</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSettings(true)} style={btn('#6b7280')}>⚙️ Settings</button>
          <button onClick={() => setShowRequest(true)} style={btn('#2563eb')}>➕ New Withdrawal</button>
        </div>
      </div>

      {/* Window Status */}
      <div style={{
        background: window.ok ? '#dcfce7' : '#fef9e7',
        border: `1px solid ${window.ok ? '#86efac' : '#fcd34d'}`,
        padding: '14px 20px', borderRadius: '10px', marginBottom: '20px',
        color: window.ok ? '#065f46' : '#b45309', fontWeight: '600'
      }}>
        {window.ok
          ? `✅ Withdrawal window OPEN — Period: ${window.period}`
          : `⏳ Withdrawal window CLOSED — Opens ${summary.windowLabel || 'June 15–30 and December 15–30'}`}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <Card title="Pending" value={counts.pending} color="#b45309" bg="#fef9e7" raw />
        <Card title="Approved" value={counts.approved} color="#0369a1" bg="#e0f2fe" raw />
        <Card title="Paid" value={counts.paid} color="#15803d" bg="#dcfce7" raw />
        <Card title="Rejected" value={counts.rejected} color="#dc2626" bg="#fee2e2" raw />
        <Card title="Total Paid Out" value={summary.totalPaid} color="#7c3aed" bg="#f3e8ff" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={input}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={input}>
          <option value="">All Sources</option>
          <option value="savings">Savings</option>
          <option value="dividends">Dividends</option>
        </select>
      </div>

      {/* Table */}
      {withdrawals.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No withdrawals found.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Date</th>
                <th style={th}>Member</th>
                <th style={th}>Source</th>
                <th style={th}>Period</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>Payment</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w, i) => (
                <tr key={w._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{new Date(w.requestedDate).toLocaleDateString()}</td>
                  <td style={td}>
                    {w.memberName}
                    {w.memberNumber && <div style={{ fontSize: '11px', color: '#64748b' }}>{w.memberNumber}</div>}
                  </td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{w.source}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>
                    {w.period}
                    {w.period === 'override' && <span style={{ marginLeft: '4px', color: '#dc2626', fontSize: '11px', fontWeight: '700' }}>⚠️</span>}
                  </td>
                  <td style={{ ...td, fontWeight: '700' }}>UGX {w.amount.toLocaleString()}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                      background: statusBg(w.status), color: statusColor(w.status)
                    }}>{w.status}</span>
                  </td>
                  <td style={td}>
                    {w.paymentMethod && (
                      <div style={{ fontSize: '11px' }}>
                        {w.paymentMethod === 'cash' ? '💵 Cash' : '📱 Mobile'}
                        {w.paymentReference && <div style={{ color: '#64748b' }}>{w.paymentReference}</div>}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {w.status === 'pending' && (
                      <>
                        <button onClick={() => approve(w._id)} style={btnMini('#22c55e')}>Approve</button>
                        <button onClick={() => reject(w._id)} style={btnMini('#ef4444')}>Reject</button>
                      </>
                    )}
                    {w.status === 'approved' && (
                      <button onClick={() => setShowPayModal(w._id)} style={btnMini('#7c3aed')}>Pay</button>
                    )}
                    {w.status === 'paid' && <span style={{ color: '#15803d', fontSize: '11px', fontWeight: '600' }}>✅ Done</span>}
                    {w.status === 'rejected' && <span style={{ color: '#dc2626', fontSize: '11px' }}>✕ Rejected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== REQUEST MODAL ==================== */}
      {showRequest && (
        <Modal onClose={() => { setShowRequest(false); setEligibility(null); }} title="New Withdrawal Request">
          <form onSubmit={submitRequest}>
            <Field label="Member *">
              <select value={requestForm.memberId} onChange={e => setRequestForm({ ...requestForm, memberId: e.target.value })} required style={inputFull}>
                <option value="">Select Member</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>
                ))}
              </select>
            </Field>

            <Field label="Source *">
              <select value={requestForm.source} onChange={e => setRequestForm({ ...requestForm, source: e.target.value })} style={inputFull}>
                <option value="savings">Savings ({settings?.savingsCapPercent || 20}% cap)</option>
                <option value="dividends">Dividends (no cap)</option>
              </select>
            </Field>

            {eligibility && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                <div><strong>Savings:</strong> UGX {eligibility.savings.toLocaleString()}</div>
                <div><strong>Dividends:</strong> UGX {eligibility.dividendBalance.toLocaleString()}</div>
                <div><strong>Max from savings:</strong> UGX {Math.floor(eligibility.savings * ((eligibility.savingsCapPercent || 20) / 100)).toLocaleString()}</div>
                {eligibility.hasActiveLoan && <div style={{ color: '#dc2626', fontWeight: '600' }}>⚠️ Member has an active loan — withdrawals blocked</div>}
                {!eligibility.window.ok && (
                  <div style={{ color: '#b45309', fontWeight: '600', marginTop: '6px' }}>
                    ⚠️ Outside withdrawal window ({eligibility.windowLabel})
                  </div>
                )}
              </div>
            )}

            <Field label="Amount (UGX) *">
              <input type="number" value={requestForm.amount} onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })} required style={inputFull} />
            </Field>

            <Field label="Notes (optional)">
              <input type="text" value={requestForm.notes} onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })} style={inputFull} />
            </Field>

            {eligibility && !eligibility.window.ok && (
              <Field label="⚠️ Override Reason (required to proceed outside window)">
                <input type="text" value={requestForm.overrideReason} onChange={e => setRequestForm({ ...requestForm, overrideReason: e.target.value })} style={inputFull} placeholder="e.g., Medical emergency approved by chairman" />
              </Field>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="submit" style={btn('#2563eb')}>Submit Request</button>
              <button type="button" onClick={() => { setShowRequest(false); setEligibility(null); }} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================== PAYMENT MODAL ==================== */}
      {showPayModal && (
        <Modal onClose={() => setShowPayModal(null)} title="Record Payment">
          <form onSubmit={submitPayment}>
            <Field label="Payment Method *">
              <select value={paymentForm.paymentMethod} onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })} style={inputFull}>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </Field>

            {paymentForm.paymentMethod === 'mobile_money' && (
              <Field label="Mobile Money Reference / Txn Code">
                <input type="text" value={paymentForm.paymentReference} onChange={e => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })} style={inputFull} placeholder="e.g., MP240927.1234.A56789" />
              </Field>
            )}

            <Field label="Paid By">
              <input type="text" value={paymentForm.paidBy} onChange={e => setPaymentForm({ ...paymentForm, paidBy: e.target.value })} style={inputFull} />
            </Field>

            <div style={{ background: '#f3e8ff', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#7c3aed' }}>
              ℹ️ A receipt will be auto-generated after payment.
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="submit" style={btn('#22c55e')}>Confirm Payment</button>
              <button type="button" onClick={() => setShowPayModal(null)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================== SETTINGS MODAL ==================== */}
      {showSettings && settings && (
        <Modal onClose={() => setShowSettings(false)} title="⚙️ Withdrawal Settings">
          <form onSubmit={saveSettings}>
            <SectionTitle>June Window</SectionTitle>
            <Field label="Enabled">
              <select value={settings.juneEnabled ? 'yes' : 'no'} onChange={e => setSettings({ ...settings, juneEnabled: e.target.value === 'yes' })} style={inputFull}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Start Day (1–30)">
                <input type="number" min="1" max="30" value={settings.juneStartDay} onChange={e => setSettings({ ...settings, juneStartDay: parseInt(e.target.value) || 1 })} style={inputFull} />
              </Field>
              <Field label="End Day (1–30)">
                <input type="number" min="1" max="30" value={settings.juneEndDay} onChange={e => setSettings({ ...settings, juneEndDay: parseInt(e.target.value) || 30 })} style={inputFull} />
              </Field>
            </div>

            <SectionTitle>December Window</SectionTitle>
            <Field label="Enabled">
              <select value={settings.decemberEnabled ? 'yes' : 'no'} onChange={e => setSettings({ ...settings, decemberEnabled: e.target.value === 'yes' })} style={inputFull}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Start Day (1–30)">
                <input type="number" min="1" max="30" value={settings.decemberStartDay} onChange={e => setSettings({ ...settings, decemberStartDay: parseInt(e.target.value) || 1 })} style={inputFull} />
              </Field>
              <Field label="End Day (1–30)">
                <input type="number" min="1" max="30" value={settings.decemberEndDay} onChange={e => setSettings({ ...settings, decemberEndDay: parseInt(e.target.value) || 30 })} style={inputFull} />
              </Field>
            </div>

            <SectionTitle>Rules</SectionTitle>
            <Field label="Savings Cap (%)">
              <input type="number" min="0" max="100" value={settings.savingsCapPercent} onChange={e => setSettings({ ...settings, savingsCapPercent: parseInt(e.target.value) || 20 })} style={inputFull} />
            </Field>
            <Field label="Block withdrawals if member has active loan">
              <select value={settings.blockOnActiveLoan ? 'yes' : 'no'} onChange={e => setSettings({ ...settings, blockOnActiveLoan: e.target.value === 'yes' })} style={inputFull}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Allow admin override outside window">
              <select value={settings.allowOverride ? 'yes' : 'no'} onChange={e => setSettings({ ...settings, allowOverride: e.target.value === 'yes' })} style={inputFull}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="submit" disabled={savingSettings} style={{ ...btn('#2563eb'), opacity: savingSettings ? 0.6 : 1 }}>
                {savingSettings ? 'Saving...' : '💾 Save Settings'}
              </button>
              <button type="button" onClick={() => setShowSettings(false)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '12px 28px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================
const statusBg = (s) => ({ pending: '#fef9e7', approved: '#e0f2fe', paid: '#dcfce7', rejected: '#fee2e2', cancelled: '#f1f5f9' }[s] || '#f1f5f9');
const statusColor = (s) => ({ pending: '#b45309', approved: '#0369a1', paid: '#15803d', rejected: '#dc2626', cancelled: '#64748b' }[s] || '#64748b');

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f3460', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '18px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
    {children}
  </div>
);

const Card = ({ title, value, color, bg, raw }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px' }}>
    <div style={{ fontSize: '12px', color, fontWeight: '600' }}>{title}</div>
    <div style={{ fontSize: '20px', fontWeight: '700', color }}>
      {raw ? value : `UGX ${(value || 0).toLocaleString()}`}
    </div>
  </div>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '560px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const btn = (bg) => ({ padding: '10px 20px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' });
const btnMini = (bg) => ({ padding: '5px 12px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', marginRight: '4px' });
const input = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minWidth: '160px' };
const inputFull = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };