'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '../api-client';

const API = 'https://pesaflow-api-jpll.onrender.com';

export default function StatementsPage() {
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      const res = await apiFetch('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadPreview = async () => {
    if (!selectedMember) return alert('Select a member first');
    setFetching(true);
    setPreview(null);
    try {
      const res = await apiFetch(`/api/members/${selectedMember}/statement?from=${from}&to=${to}`);
      const data = await res.json();
      if (data.error) {
        alert('❌ ' + data.error);
      } else {
        setPreview(data);
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setFetching(false);
    }
  };

  const openPDF = () => {
    if (!selectedMember) return alert('Select a member first');
    window.open(`${API}/api/members/${selectedMember}/statement/pdf?from=${from}&to=${to}`, '_blank');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>📊 Member Statements</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>
        Generate a member's running ledger showing cash in, cash out, and balance.
      </p>

      {/* Filters */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
        <div>
          <label style={labelStyle}>Member</label>
          <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} style={inputStyle}>
            <option value="">Select Member</option>
            {members.map(m => (
              <option key={m._id} value={m._id}>
                {m.firstName} {m.surname} ({m.memberNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={loadPreview} disabled={fetching} style={{ padding: '10px 20px', background: fetching ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: fetching ? 'not-allowed' : 'pointer', height: '42px' }}>
          {fetching ? 'Loading...' : '🔍 Load Preview'}
        </button>
      </div>

      {/* Quick date ranges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <QuickRange label="This Month" from={firstOfMonth()} to={today()} setFrom={setFrom} setTo={setTo} />
        <QuickRange label="This Year" from={firstOfYear()} to={today()} setFrom={setFrom} setTo={setTo} />
        <QuickRange label="Last Year" from={firstOfYear(-1)} to={lastOfYear(-1)} setFrom={setFrom} setTo={setTo} />
        <QuickRange label="All Time" from="2020-01-01" to={today()} setFrom={setFrom} setTo={setTo} />
      </div>

      {/* Action buttons */}
      {selectedMember && (
        <div style={{ marginBottom: '20px' }}>
          <button onClick={openPDF} style={{ padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '15px' }}>
            📄 Download PDF Statement
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div>
          {/* Header */}
          <div style={{ background: '#0f3460', color: '#fff', padding: '20px', borderRadius: '12px 12px 0 0' }}>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>{preview.member.name}</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>{preview.member.memberNumber}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '6px' }}>
              {new Date(preview.from).toLocaleDateString()} → {new Date(preview.to).toLocaleDateString()}
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px', background: '#f8fafc' }}>
            <SummaryCard title="Total Cash In" value={preview.totals.cashIn} color="#15803d" />
            <SummaryCard title="Total Cash Out" value={preview.totals.cashOut} color="#dc2626" />
            <SummaryCard title="Closing Balance" value={preview.totals.closingBalance} color="#0369a1" />
          </div>

          {/* Ledger Table */}
          {preview.entries.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280', background: '#fff', borderRadius: '0 0 12px 12px', border: '1px solid #e5e7eb', borderTop: 'none' }}>
              No transactions in this period.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '0 0 12px 12px', border: '1px solid #e5e7eb', borderTop: 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={th}>Date</th>
                    <th style={th}>Description</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cash In</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cash Out</th>
                    <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={td}>{new Date(e.date).toLocaleDateString()}</td>
                      <td style={td}>{e.description || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: e.cashIn > 0 ? '#15803d' : '#cbd5e1', fontWeight: e.cashIn > 0 ? '600' : '400' }}>
                        {e.cashIn > 0 ? `+${e.cashIn.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: e.cashOut > 0 ? '#dc2626' : '#cbd5e1', fontWeight: e.cashOut > 0 ? '600' : '400' }}>
                        {e.cashOut > 0 ? `-${e.cashOut.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: '600' }}>
                        {e.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#0f3460', color: '#fff', fontWeight: '700' }}>
                    <td style={{ ...td, color: '#fff' }} colSpan={2}>TOTALS</td>
                    <td style={{ ...td, color: '#fff', textAlign: 'right' }}>{preview.totals.cashIn.toLocaleString()}</td>
                    <td style={{ ...td, color: '#fff', textAlign: 'right' }}>{preview.totals.cashOut.toLocaleString()}</td>
                    <td style={{ ...td, color: '#fff', textAlign: 'right' }}>{preview.totals.closingBalance.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Back to Dashboard */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '12px 28px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
};
const firstOfYear = (offset = 0) => {
  const d = new Date(); d.setFullYear(d.getFullYear() + offset, 0, 1);
  return d.toISOString().split('T')[0];
};
const lastOfYear = (offset = 0) => {
  const d = new Date(); d.setFullYear(d.getFullYear() + offset, 11, 31);
  return d.toISOString().split('T')[0];
};

const QuickRange = ({ label, from, to, setFrom, setTo }) => (
  <button
    onClick={() => { setFrom(from); setTo(to); }}
    style={{ padding: '8px 14px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
  >{label}</button>
);

const SummaryCard = ({ title, value, color }) => (
  <div style={{ background: '#fff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{title}</div>
    <div style={{ fontSize: '20px', fontWeight: '700', color }}>
      UGX {(value || 0).toLocaleString()}
    </div>
  </div>
);

const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#334155' };
const td = { padding: '10px 12px' };