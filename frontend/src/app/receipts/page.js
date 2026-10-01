'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../api-client';

const API = 'https://pesaflow-api-jpll.onrender.com';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { fetchReceipts(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchReceipts, 300);
    return () => clearTimeout(t);
  }, [search, typeFilter, statusFilter, startDate, endDate]);

  const fetchReceipts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiFetch(`/api/receipts?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReceipts(data);
        setSummary({ total: data.length, totalAmount: data.reduce((s, r) => s + (Number(r.amount) || 0), 0) });
      } else {
        setReceipts(data.receipts || []);
        setSummary({ total: data.total || 0, totalAmount: data.totalAmount || 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openPDF = (id) => {
    window.open(`${API}/api/receipts/${id}/pdf`, '_blank');
  };

  const cancelReceipt = async (id) => {
    const reason = prompt('Reason for cancelling this receipt:');
    if (!reason) return;
    try {
     const res = await apiFetch(`/api/receipts/${id}/cancel`, {
  method: 'POST',
  body: JSON.stringify({ reason, cancelledBy: 'admin' })
});
      const d = await res.json();
      if (res.ok) {
        alert('Receipt cancelled');
        fetchReceipts();
      } else alert(d.error);
    } catch (err) { alert('Network error'); }
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter(''); setStatusFilter(''); setStartDate(''); setEndDate('');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>🧾 Receipts & Vouchers</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card title="Total Receipts" value={summary.total} color="#0369a1" bg="#e0f2fe" icon="🧾" raw />
        <Card title="Total Amount Issued" value={summary.totalAmount} color="#15803d" bg="#dcfce7" icon="💰" />
      </div>

      {/* Filters */}
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
        <input
          type="text"
          placeholder="Search number, member, description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, gridColumn: 'span 2' }}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
          <option value="">All Types</option>
          <option value="savings_deposit">Savings Deposit</option>
          <option value="savings_withdrawal">Savings Withdrawal</option>
          <option value="share_purchase">Share Purchase</option>
          <option value="membership_fee">Membership Fee</option>
          <option value="loan_disbursement">Loan Disbursement</option>
          <option value="loan_repayment">Loan Repayment</option>
          <option value="dividend">Dividend</option>
          <option value="penalty">Penalty</option>
          <option value="external_donation">External Donation</option>
          <option value="club_expense">Club Expense</option>
          <option value="fund_transfer">Fund Transfer</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} placeholder="From" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} placeholder="To" />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={clearFilters} style={btnMini('#6b7280')}>Clear Filters</button>
      </div>

      {/* Table */}
      {receipts.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No receipts found.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Receipt #</th>
                <th style={th}>Date</th>
                <th style={th}>Type</th>
                <th style={th}>Member</th>
                <th style={th}>Description</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r, i) => (
                <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{r.receiptNumber}</td>
                  <td style={td}>{new Date(r.date).toLocaleDateString()}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{r.type.replace(/_/g, ' ')}</td>
                  <td style={td}>
                    {r.memberName || '—'}
                    {r.memberNumber && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.memberNumber}</div>}
                  </td>
                  <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description || '—'}
                  </td>
                  <td style={{ ...td, fontWeight: '600' }}>UGX {(r.amount || 0).toLocaleString()}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                      background: r.status === 'issued' ? '#d1fae5' : '#fee2e2',
                      color: r.status === 'issued' ? '#065f46' : '#991b1b'
                    }}>{r.status}</span>
                  </td>
                  <td style={td}>
                    <button onClick={() => openPDF(r._id)} style={btnMini('#7c3aed')}>PDF</button>
                    {r.status === 'issued' && (
                      <button onClick={() => cancelReceipt(r._id)} style={btnMini('#dc2626')}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Back to Dashboard */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <a href="/dashboard" style={{
          display: 'inline-block', padding: '12px 28px', background: '#0f3460',
          color: '#fff', borderRadius: '8px', textDecoration: 'none',
          fontWeight: '600', fontSize: '14px'
        }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

// ===== HELPERS =====
const Card = ({ title, value, color, bg, icon, raw }) => (
  <div style={{ background: bg, padding: '18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>
        {raw ? value : `UGX ${(value || 0).toLocaleString()}`}
      </div>
    </div>
    <span style={{ fontSize: '28px' }}>{icon}</span>
  </div>
);

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px' };
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '11px', cursor: 'pointer', marginRight: '4px' });
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };