'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api-client';

export default function AdminShareRequests() {
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadAll(); }, [filter]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/share-requests' : `/api/share-requests?status=${filter}`;
      const res = await apiFetch(url);
      const d = await res.json();
      setRequests(Array.isArray(d.requests) ? d.requests : []);
      setPendingCount(d.pendingCount || 0);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (req) => {
    if (!confirm(`Approve ${req.memberName}'s request for ${req.quantity} ${req.shareType} shares (UGX ${Number(req.amountDue).toLocaleString()})?`)) return;
    setBusy(true);
    setMessage('⏳ Approving…');
    try {
      const res = await apiFetch(`/api/share-requests/${req._id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ approvedBy: 'admin' })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Approved ${req.memberName}'s request. Receipt: ${d.receipt?.receiptNumber || '—'}`);
      loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally { setBusy(false); }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) { alert('Enter a reason'); return; }
    setBusy(true);
    setMessage('⏳ Rejecting…');
    try {
      const res = await apiFetch(`/api/share-requests/${rejectModal._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Rejected ${rejectModal.memberName}'s request`);
      setRejectModal(null);
      setRejectReason('');
      loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally { setBusy(false); }
  };

  const filters = [
    { key: 'pending', label: '⏳ Pending' },
    { key: 'approved', label: '✅ Approved' },
    { key: 'rejected', label: '❌ Rejected' },
    { key: 'all', label: '📋 All' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0 }}>📊 Share Requests</h1>
          <div style={{ color: '#64748b', fontSize: '14px' }}>
            Member applications to purchase shares
            {pendingCount > 0 && (
              <span style={{ marginLeft: '10px', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
        <button onClick={loadAll} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>🔄 Refresh</button>
      </div>

      {message && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: message.startsWith('✅') ? '#dcfce7' : message.startsWith('⏳') ? '#fef9e7' : '#fee2e2', color: message.startsWith('✅') ? '#065f46' : message.startsWith('⏳') ? '#b45309' : '#991b1b', fontWeight: 600 }}>{message}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '8px 16px', borderRadius: '20px',
            border: '1px solid #cbd5e1',
            background: filter === f.key ? '#0f3460' : '#fff',
            color: filter === f.key ? '#fff' : '#334155',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading…</p>
      ) : requests.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📊</div>
          <p style={{ color: '#64748b', margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Member</th>
                <th style={th}>Type</th>
                <th style={th}>Qty</th>
                <th style={th}>Amount</th>
                <th style={th}>Method</th>
                <th style={th}>Requested</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.memberName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{r.memberNumber}</div>
                  </td>
                  <td style={td}>{r.shareType}</td>
                  <td style={td}>{r.quantity}</td>
                  <td style={{ ...td, fontWeight: 600 }}>UGX {Number(r.amountDue || 0).toLocaleString()}</td>
                  <td style={td}>{r.paymentMethod}</td>
                  <td style={td}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                      background: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef9e7',
                      color: r.status === 'approved' ? '#065f46' : r.status === 'rejected' ? '#991b1b' : '#b45309'
                    }}>{r.status.toUpperCase()}</span>
                    {r.status === 'rejected' && r.rejectedReason && (
                      <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '3px' }}>{r.rejectedReason}</div>
                    )}
                    {r.status === 'approved' && r.approvedAt && (
                      <div style={{ fontSize: '11px', color: '#065f46', marginTop: '3px' }}>
                        by {r.approvedBy} on {new Date(r.approvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => approve(r)} disabled={busy} style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600 }}>✅ Approve</button>
                        <button onClick={() => { setRejectModal(r); setRejectReason(''); }} disabled={busy} style={{ padding: '5px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600 }}>❌ Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ color: '#2563eb', textDecoration: 'none' }}>← Back to Dashboard</a>
      </div>

      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '440px', maxWidth: '92vw' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '17px' }}>Reject Request</h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '14px' }}>
              {rejectModal.memberName} — {rejectModal.quantity} × {rejectModal.shareType}
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Reason</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows="3" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} placeholder="e.g., Insufficient payment verification" />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button onClick={() => setRejectModal(null)} disabled={busy} style={{ padding: '8px 16px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitReject} disabled={busy} style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Rejecting…' : 'Reject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '12px' };
const td = { padding: '10px' };