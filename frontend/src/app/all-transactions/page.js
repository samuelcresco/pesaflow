'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '../api-client';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'savings', label: 'Savings' },
  { value: 'withdrawal', label: 'Withdrawals' },
  { value: 'loan_disbursement', label: 'Loan Disbursements' },
  { value: 'loan_repayment', label: 'Loan Repayments' },
  { value: 'dividend', label: 'Dividends' },
  { value: 'club_expense', label: 'Club Expenses' },
  { value: 'business', label: 'Business' }
];

export default function AllTransactions() {
  const searchParams = useSearchParams();
  const memberIdFromUrl = searchParams.get('member');

  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const [memberFilter, setMemberFilter] = useState(memberIdFromUrl || '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const [totals, setTotals] = useState({ totalIn: 0, totalOut: 0, net: 0, count: 0 });

  const [reverseModal, setReverseModal] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => { fetchMembers(); }, []);
  useEffect(() => { fetchTransactions(); }, [memberFilter, typeFilter, directionFilter, startDate, endDate]);

  useEffect(() => {
    if (memberFilter) {
      const m = members.find(x => x._id === memberFilter);
      setMember(m || null);
    } else {
      setMember(null);
    }
  }, [memberFilter, members]);

  useEffect(() => {
    const t = setTimeout(() => fetchTransactions(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMembers = async () => {
    try {
      const res = await apiFetch('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (memberFilter) params.append('memberId', memberFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (directionFilter && directionFilter !== 'all') params.append('direction', directionFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (search) params.append('search', search);

      const res = await apiFetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
        setTotals({ totalIn: 0, totalOut: 0, net: 0, count: data.length });
      } else {
        setTransactions(data.transactions || []);
        setTotals({
          totalIn: data.totalIn || 0,
          totalOut: data.totalOut || 0,
          net: data.net || 0,
          count: data.count || 0
        });
      }
    } catch (err) {
      console.error(err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const openReverse = (txn) => { setReverseModal(txn); setReverseReason(''); };

  const submitReverse = async () => {
    if (!reverseReason.trim()) return alert('Reason is required');
    setReversing(true);
    try {
      const res = await apiFetch('/api/transactions/reverse', {
        method: 'POST',
        body: JSON.stringify({
          sourceModel: reverseModal.sourceModel,
          sourceId: reverseModal.sourceId,
          reason: reverseReason.trim(),
          reversedBy: 'admin'
        })
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + (d.message || 'Reversed'));
        setReverseModal(null);
        setReverseReason('');
        fetchTransactions();
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('❌ Network error'); }
    finally { setReversing(false); }
  };

  const openDetail = async (txn) => {
    setDetailModal({ loading: true, txn });
    try {
      const res = await apiFetch(`/api/transactions/${txn.sourceModel}/${txn.sourceId}`);
      const data = await res.json();
      if (res.ok) setDetailModal({ loading: false, txn, detail: data });
      else setDetailModal({ loading: false, txn, detail: null, error: data.error });
    } catch (err) {
      setDetailModal({ loading: false, txn, detail: null, error: 'Network error' });
    }
  };

  const canReverse = (txn) => ['Saving', 'Withdrawal', 'Repayment', 'ClubExpense', 'BusinessTransaction'].includes(txn.sourceModel);

  const clearFilters = () => {
    setMemberFilter(''); setTypeFilter('all'); setDirectionFilter('all');
    setStartDate(''); setEndDate(''); setSearch('');
  };

  const typeLabel = (type) => ({
    savings: 'Savings', withdrawal: 'Withdrawal', loan_disbursement: 'Loan Disbursement',
    loan_repayment: 'Loan Repayment', dividend: 'Dividend', club_expense: 'Club Expense', business: 'Business'
  }[type] || type);

  const typeColor = (type) => ({
    savings: '#0369a1', withdrawal: '#dc2626', loan_disbursement: '#7c3aed',
    loan_repayment: '#15803d', dividend: '#0891b2', club_expense: '#b45309', business: '#6366f1'
  }[type] || '#64748b');

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>📋 All Transactions</h1>
          {member && <p style={{ color: '#64748b', marginTop: '4px' }}>Filtered: {member.firstName} {member.surname} ({member.memberNumber})</p>}
        </div>
        <a href="/dashboard" style={btnSecondary}>← Back to Dashboard</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <SummaryCard title="Total Cash In" value={totals.totalIn} color="#15803d" bg="#dcfce7" icon="⬇️" />
        <SummaryCard title="Total Cash Out" value={totals.totalOut} color="#dc2626" bg="#fee2e2" icon="⬆️" />
        <SummaryCard title="Net" value={totals.net} color={totals.net >= 0 ? '#0369a1' : '#b91c1c'} bg="#e0f2fe" icon="📊" signed />
        <SummaryCard title="Transactions" value={totals.count} color="#475569" bg="#f1f5f9" icon="🔢" raw />
      </div>

      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...input, gridColumn: 'span 2' }} />
        <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} style={input}>
          <option value="">All Members</option>
          {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={input}>
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} style={input}>
          <option value="all">All Directions</option>
          <option value="in">Cash In</option>
          <option value="out">Cash Out</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...input, maxWidth: '180px' }} />
        <button onClick={clearFilters} style={btnSecondary}>Clear Filters</button>
      </div>

      {transactions.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No transactions found.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Date</th><th style={th}>Member / Source</th><th style={th}>Type</th>
                <th style={th}>Category</th><th style={th}>Description</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={{ ...th, textAlign: 'center' }}>In/Out</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={`${t.sourceModel}-${t._id}-${i}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={td}>
                    <div>{t.memberName || '—'}</div>
                    {t.memberNumber && <div style={{ fontSize: '11px', color: '#64748b' }}>{t.memberNumber}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: typeColor(t.type) + '20', color: typeColor(t.type) }}>{typeLabel(t.type)}</span>
                  </td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{t.category}</td>
                  <td style={{ ...td, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700', color: t.direction === 'in' ? '#15803d' : '#dc2626' }}>
                    {t.direction === 'in' ? '+' : '-'} {t.amount.toLocaleString()}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: t.direction === 'in' ? '#dcfce7' : '#fee2e2', color: t.direction === 'in' ? '#065f46' : '#991b1b' }}>
                      {t.direction === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openDetail(t)} style={btnMini('#0369a1')}>View</button>
                      {canReverse(t) && <button onClick={() => openReverse(t)} style={btnMini('#dc2626')}>Reverse</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reverseModal && (
        <Modal onClose={() => setReverseModal(null)} title="↩️ Reverse Transaction">
          <div style={{ background: '#fef9e7', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', border: '1px solid #fcd34d' }}>
            <strong>You are about to reverse:</strong>
            <div style={{ marginTop: '6px' }}>{reverseModal.description} — <strong>UGX {reverseModal.amount.toLocaleString()}</strong></div>
          </div>
          <Field label="Reason for Reversal *">
            <textarea value={reverseReason} onChange={e => setReverseReason(e.target.value)} rows="3" style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={submitReverse} disabled={reversing} style={{ padding: '10px 20px', background: reversing ? '#94a3b8' : '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: reversing ? 'not-allowed' : 'pointer' }}>{reversing ? 'Reversing...' : 'Confirm Reversal'}</button>
            <button onClick={() => setReverseModal(null)} style={btnSecondary}>Cancel</button>
          </div>
        </Modal>
      )}

      {detailModal && (
        <Modal onClose={() => setDetailModal(null)} title="📄 Transaction Detail">
          {detailModal.loading ? <p>Loading...</p> : detailModal.error ? <p style={{ color: '#dc2626' }}>❌ {detailModal.error}</p> : detailModal.detail ? (
            <div>
              <DetailRow label="Source" value={detailModal.txn.sourceModel} />
              <DetailRow label="Type" value={typeLabel(detailModal.txn.type)} />
              <DetailRow label="Date" value={new Date(detailModal.txn.date).toLocaleString()} />
              <DetailRow label="Amount" value={`UGX ${detailModal.txn.amount.toLocaleString()}`} />
              <DetailRow label="Direction" value={detailModal.txn.direction === 'in' ? 'Cash In' : 'Cash Out'} />
              <DetailRow label="Description" value={detailModal.txn.description} />
              {detailModal.txn.memberName && <DetailRow label="Member" value={`${detailModal.txn.memberName} (${detailModal.txn.memberNumber || '—'})`} />}
            </div>
          ) : <p>No details.</p>}
        </Modal>
      )}
    </div>
  );
}

const SummaryCard = ({ title, value, color, bg, icon, signed, raw }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '12px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color }}>{raw ? value : (signed && value >= 0 ? '+' : '') + `UGX ${Number(value || 0).toLocaleString()}`}</div>
    </div>
    <span style={{ fontSize: '24px' }}>{icon}</span>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ width: '140px', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>{label}</div>
    <div style={{ flex: 1, fontSize: '13px' }}>{value || '—'}</div>
  </div>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' });
const input = { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '100%' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };