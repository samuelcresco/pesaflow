'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../api-client';

export default function AdminConstitution() {
  const [info, setInfo] = useState({ constitution: null, fee: 0 });
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState('1.0');
  const [title, setTitle] = useState('Club Constitution');

  // Mark Paid inline modal
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'cash', saving: false });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [infoRes, listRes] = await Promise.all([
        apiFetch('/api/constitution/info').then(r => r.json()),
        apiFetch('/api/constitution/access-list').then(r => r.json())
      ]);
      setInfo(infoRes);
      setMembers(Array.isArray(listRes) ? listRes : []);
      if (infoRes?.fee) setPayForm(p => ({ ...p, amount: Number(infoRes.fee) || 0 }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('❌ Only PDF files are allowed');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setMessage('❌ File too large (max 8 MB)');
      return;
    }

    setUploading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch('/api/constitution/upload', {
          method: 'POST',
          body: JSON.stringify({
            title,
            version,
            pdfData: reader.result,
            fileName: file.name,
            fileSize: file.size
          })
        });
        const d = await res.json();
        if (res.ok) {
          setMessage('✅ Constitution uploaded');
          loadAll();
        } else {
          setMessage('❌ ' + d.error);
        }
      } catch (err) {
        setMessage('❌ Network error');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!confirm('Remove the current constitution? Members will no longer see it.')) return;
    try {
      const res = await apiFetch('/api/constitution', { method: 'DELETE' });
      if (res.ok) { setMessage('✅ Removed'); loadAll(); }
    } catch (err) { setMessage('❌ Network error'); }
  };

  // ==================== MARK PAID — inline modal ====================
  const openPayModal = (member) => {
    const available = (Number(member.savings) || 0) - (Number(member.lockedSavings) || 0);
    setPayModal({ member, available });
    setPayForm({
      amount: Number(info.fee) || 0,
      method: 'cash',
      saving: false
    });
  };

  const closePayModal = () => {
    setPayModal(null);
    setPayForm({ amount: 0, method: 'cash', saving: false });
  };

  const submitPay = async () => {
    if (!payModal) return;
    const { member, available } = payModal;
    const amt = Number(payForm.amount) || 0;

    if (amt <= 0) {
      setMessage('❌ Amount must be greater than 0');
      return;
    }

    if (payForm.method === 'savings' && available < amt) {
      setMessage(`❌ Insufficient savings. Available: UGX ${available.toLocaleString()}`);
      return;
    }

    setPayForm(f => ({ ...f, saving: true }));
    setMessage('⏳ Marking as paid…');

    try {
      const res = await apiFetch(`/api/constitution/member/${member._id}/access`, {
        method: 'PUT',
        body: JSON.stringify({
          paid: true,
          amount: amt,
          paymentMethod: payForm.method
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      let msg = `✅ Marked ${member.firstName} as paid`;
      if (d.receipt?.receiptNumber) msg += ` — Receipt: ${d.receipt.receiptNumber}`;
      setMessage(msg);
      closePayModal();
      loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setPayForm(f => ({ ...f, saving: false }));
    }
  };

  const markUnpaid = async (member) => {
    if (!confirm(`Mark ${member.firstName} ${member.surname} as UNPAID? The payment will be reversed.`)) return;
    setMessage('⏳ Reversing payment…');
    try {
      const res = await apiFetch(`/api/constitution/member/${member._id}/access`, {
        method: 'PUT',
        body: JSON.stringify({ paid: false, amount: 0, paymentMethod: 'cash' })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Marked ${member.firstName} as unpaid`);
      loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading…</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>📖 Club Constitution</h1>
      <p style={{ color: '#64748b' }}>Upload and manage who can download it. Fee is set in Share Settings.</p>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: message.startsWith('✅') ? '#dcfce7' : message.startsWith('⏳') ? '#fef9e7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : message.startsWith('⏳') ? '#b45309' : '#991b1b',
          fontWeight: 600
        }}>{message}</div>
      )}

      {/* UPLOAD SECTION */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ marginTop: 0, fontSize: '16px' }}>📄 Current Constitution</h2>
        {info.constitution ? (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, color: '#065f46' }}>✅ {info.constitution.title} — v{info.constitution.version}</div>
            <div style={{ fontSize: '12px', color: '#065f46', marginTop: '4px' }}>
              {info.constitution.fileName} · {Math.round((info.constitution.fileSize || 0) / 1024)} KB · uploaded {new Date(info.constitution.updatedAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, color: '#991b1b' }}>⚠️ No constitution uploaded yet</div>
            <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
              Members will see "Constitution has not been uploaded yet" until you upload a PDF below.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Version</label>
            <input value={version} onChange={e => setVersion(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            {uploading ? 'Uploading…' : info.constitution ? '🔄 Replace PDF' : '📤 Upload PDF'}
            <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
          </label>

          {info.constitution && (
            <a
              href="http://localhost:5000/api/constitution/download-admin"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '10px 20px', background: '#0ea5e9', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
            >
              👁 View / Download
            </a>
          )}

          {info.constitution && (
            <button onClick={handleDelete} style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              🗑 Remove
            </button>
          )}
        </div>
      </div>

      {/* ACCESS LIST */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>👥 Member Access</h2>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Fee: <strong style={{ color: '#0f3460' }}>UGX {(info.fee || 0).toLocaleString()}</strong>
            <span style={{ marginLeft: '8px', color: '#94a3b8' }}>(set in Share Settings)</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Member No</th>
                <th style={th}>Name</th>
                <th style={th}>Phone</th>
                <th style={th}>Status</th>
                <th style={th}>Paid Date</th>
                <th style={th}>Amount</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{m.memberNumber}</td>
                  <td style={td}>{m.firstName} {m.surname}</td>
                  <td style={td}>{m.contact}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                      background: m.constitutionPaid ? '#dcfce7' : '#fee2e2',
                      color: m.constitutionPaid ? '#065f46' : '#991b1b'
                    }}>{m.constitutionPaid ? 'Paid' : 'Unpaid'}</span>
                  </td>
                  <td style={td}>{m.constitutionPaidDate ? new Date(m.constitutionPaidDate).toLocaleDateString() : '—'}</td>
                  <td style={td}>{m.constitutionPaidAmount ? `UGX ${Number(m.constitutionPaidAmount).toLocaleString()}` : '—'}</td>
                  <td style={td}>
                    {m.constitutionPaid ? (
                      <button onClick={() => markUnpaid(m)} style={btnMini('#dc2626')}>Mark Unpaid</button>
                    ) : (
                      <button onClick={() => openPayModal(m)} style={btnMini('#22c55e')}>Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ color: '#2563eb', textDecoration: 'none' }}>← Back to Dashboard</a>
      </div>

      {/* ==================== MARK PAID MODAL ==================== */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '480px', maxWidth: '92vw' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Mark Constitution Paid</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 18px 0' }}>
              {payModal.member.firstName} {payModal.member.surname} — {payModal.member.memberNumber}
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Amount (UGX)</label>
              <input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                style={inputStyle}
                min="1"
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Prefilled from Share Settings fee. Editable.
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Payment Method</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <label style={{
                  flex: 1, padding: '10px', border: `2px solid ${payForm.method === 'cash' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                  background: payForm.method === 'cash' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px'
                }}>
                  <input type="radio" name="m" value="cash" checked={payForm.method === 'cash'} onChange={() => setPayForm({ ...payForm, method: 'cash' })} style={{ display: 'none' }} />
                  💵 Cash
                </label>
                <label style={{
                  flex: 1, padding: '10px', border: `2px solid ${payForm.method === 'savings' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                  background: payForm.method === 'savings' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px'
                }}>
                  <input type="radio" name="m" value="savings" checked={payForm.method === 'savings'} onChange={() => setPayForm({ ...payForm, method: 'savings' })} style={{ display: 'none' }} />
                  💰 From Savings
                </label>
              </div>
              {payForm.method === 'savings' && (
                <div style={{ fontSize: '12px', color: '#b45309', marginTop: '6px', background: '#fef9e7', padding: '8px', borderRadius: '6px' }}>
                  Available savings: <strong>UGX {payModal.available.toLocaleString()}</strong>
                  {payModal.available < Number(payForm.amount) && ' — Insufficient!'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={closePayModal}
                disabled={payForm.saving}
                style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={submitPay}
                disabled={payForm.saving}
                style={{
                  padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none',
                  borderRadius: '8px', fontWeight: 600,
                  cursor: payForm.saving ? 'wait' : 'pointer',
                  opacity: payForm.saving ? 0.6 : 1
                }}
              >
                {payForm.saving ? 'Saving…' : '✅ Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: 500, color: '#334155', fontSize: '13px' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const th = { padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '12px' };
const td = { padding: '10px' };
const btnMini = (bg) => ({ padding: '5px 12px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 });