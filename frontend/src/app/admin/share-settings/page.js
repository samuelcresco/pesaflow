'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API } from '../../api-client';

export default function ShareSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Certificate state
  const [members, setMembers] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [certSearch, setCertSearch] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueMemberId, setIssueMemberId] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState('');

  useEffect(() => { fetchSettings(); fetchMembers(); fetchCertificates(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings/shares');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
     const res = await apiFetch('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchCertificates = async () => {
    try {
     const res = await apiFetch('/api/share-certificates');
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch (err) { console.error(err); }
  };

  const updateSharePrice = (type, field, value) => {
    setSettings({
      ...settings,
      shareTypes: {
        ...settings.shareTypes,
        [type]: {
          ...settings.shareTypes[type],
          [field]: field === 'price' || field === 'maxShares' ? parseFloat(value) || 0 : value
        }
      }
    });
  };

  const updateDividend = (type, value) => {
    setSettings({
      ...settings,
      dividendPercentages: {
        ...settings.dividendPercentages,
        [type]: parseFloat(value) || 0
      }
    });
  };

  const updateEligibility = (type, value) => {
    setSettings({
      ...settings,
      loanEligibility: {
        ...settings.loanEligibility,
        [type]: value
      }
    });
  };

  const dividendTotal = () => {
    const d = settings.dividendPercentages || {};
    return (d.ordinary || 0) + (d.silver || 0) + (d.golden || 0) + (d.platinum || 0);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await apiFetch('/api/settings/shares', {
  method: 'PUT',
  body: JSON.stringify(settings)
});
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Settings saved successfully');
        setSettings(data);
      } else {
        setMessage('❌ ' + (data.error || 'Failed to save'));
      }
    } catch (err) {
      setMessage('❌ Network error');
    } finally {
      setSaving(false);
    }
  };

  const issueCertificate = async () => {
    if (!issueMemberId) return setIssueMsg('❌ Select a member');
    setIssuing(true);
    setIssueMsg('');
    try {
      const res = await apiFetch('/api/share-certificates/issue', {
  method: 'POST',
  body: JSON.stringify({
          memberId: issueMemberId,
          notes: issueNotes,
          issuedBy: 'admin'
        })
      });
      const d = await res.json();
      if (res.ok) {
        setIssueMsg('✅ Certificate issued: ' + d.certificate.certificateNumber);
        setIssueMemberId('');
        setIssueNotes('');
        fetchCertificates();
        setTimeout(() => {
          setShowIssueModal(false);
          setIssueMsg('');
        }, 1500);
      } else {
        setIssueMsg('❌ ' + (d.error || 'Failed'));
      }
    } catch (err) {
      setIssueMsg('❌ Network error');
    } finally {
      setIssuing(false);
    }
  };

  const cancelCertificate = async (id) => {
    const reason = prompt('Reason for cancelling this certificate?\n\nThe record stays in the system for audit purposes, but the certificate becomes invalid.');
    if (!reason) return;
    try {
      const res = await apiFetch(`/api/share-certificates/${id}/cancel`, {
  method: 'POST',
  body: JSON.stringify({ reason, cancelledBy: 'admin' })
});
      const d = await res.json();
      if (res.ok) {
        alert('✅ Certificate cancelled');
        fetchCertificates();
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('Network error'); }
  };

  const deleteCertificate = async (id, certNumber) => {
    if (!confirm(`⚠️ PERMANENTLY DELETE certificate ${certNumber}?\n\nThis removes it from the database FOREVER. Cannot be undone.\n\nIf you just want to invalidate it but keep the record, use "Cancel" instead.`)) return;
    const secondConfirm = prompt(`Type DELETE (in caps) to confirm permanent deletion of ${certNumber}:`);
    if (secondConfirm !== 'DELETE') {
      alert('Deletion cancelled.');
      return;
    }
    try {
      const res = await apiFetch(`/api/share-certificates/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (res.ok) {
        alert('✅ ' + d.message);
        fetchCertificates();
      } else alert('❌ ' + (d.error || 'Failed'));
    } catch (err) { alert('Network error'); }
  };

  const filteredCerts = certificates.filter(c => {
    if (!certSearch) return true;
    const q = certSearch.toLowerCase();
    return (
      (c.certificateNumber || '').toLowerCase().includes(q) ||
      (c.memberName || '').toLowerCase().includes(q) ||
      (c.memberNumber || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <div style={{ padding: '40px' }}>Loading settings...</div>;
  if (!settings) return <div style={{ padding: '40px' }}>Failed to load settings.</div>;

  const total = dividendTotal();
  const totalOk = Math.abs(total - 100) < 0.01;

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>⚙️ Share Settings</h1>
      <p style={{ color: '#64748b' }}>Configure share prices, dividend distribution, loan eligibility, and issue certificates.</p>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          background: message.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : '#991b1b'
        }}>{message}</div>
      )}

      {/* SECTION 1: SHARE PRICES */}
      <div style={sectionStyle}>
        <h2 style={sectionHeader}>📊 Share Prices</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Share Type</th>
              <th style={th}>Price (UGX)</th>
              <th style={th}>Max Shares</th>
            </tr>
          </thead>
          <tbody>
            {['ordinary', 'silver', 'golden', 'platinum'].map(type => (
              <tr key={type} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...td, textTransform: 'capitalize', fontWeight: '500' }}>{type}</td>
                <td style={td}>
                  <input type="number" value={settings.shareTypes[type]?.price || 0} onChange={e => updateSharePrice(type, 'price', e.target.value)} style={input} />
                </td>
                <td style={td}>
                  <input type="number" value={settings.shareTypes[type]?.maxShares || 0} onChange={e => updateSharePrice(type, 'maxShares', e.target.value)} style={input} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SECTION 2: DIVIDEND PERCENTAGES */}
      <div style={sectionStyle}>
        <h2 style={sectionHeader}>💰 Dividend Distribution (%)</h2>
        <p style={{ color: '#64748b', fontSize: '13px' }}>Must total 100%</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Share Type</th>
              <th style={th}>% of Dividend Pool</th>
            </tr>
          </thead>
          <tbody>
            {['ordinary', 'silver', 'golden', 'platinum'].map(type => (
              <tr key={type} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...td, textTransform: 'capitalize', fontWeight: '500' }}>{type}</td>
                <td style={td}>
                  <input type="number" value={settings.dividendPercentages[type] || 0} onChange={e => updateDividend(type, e.target.value)} style={input} />
                </td>
              </tr>
            ))}
            <tr style={{ background: totalOk ? '#dcfce7' : '#fee2e2', fontWeight: '700' }}>
              <td style={td}>TOTAL</td>
              <td style={{ ...td, color: totalOk ? '#065f46' : '#991b1b' }}>
                {total}% {totalOk ? '✅' : '❌ (must be 100%)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 3: LOAN ELIGIBILITY */}
      <div style={sectionStyle}>
        <h2 style={sectionHeader}>🏦 Loan Eligibility</h2>
        <p style={{ color: '#64748b', fontSize: '13px' }}>These are shown to members when applying for a loan.</p>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>🚨 Emergency Loan Eligibility</label>
          <input type="text" value={settings.loanEligibility?.emergency || ''} onChange={e => updateEligibility('emergency', e.target.value)} style={input} placeholder="e.g., Must have 4 Golden shares" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>🎓 School Fees Loan Eligibility</label>
          <input type="text" value={settings.loanEligibility?.school_fees || ''} onChange={e => updateEligibility('school_fees', e.target.value)} style={input} placeholder="e.g., Must have 1 Platinum share" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>💼 Business Loan Eligibility</label>
          <input type="text" value={settings.loanEligibility?.business || ''} onChange={e => updateEligibility('business', e.target.value)} style={input} placeholder="e.g., Must have 1 Platinum + 1 Silver share" />
        </div>
      </div>

      {/* SAVE BUTTON */}
      <div style={{ textAlign: 'right', marginTop: '24px' }}>
        <button
          onClick={handleSave}
          disabled={saving || !totalOk}
          style={{
            padding: '14px 32px',
            background: totalOk ? '#22c55e' : '#94a3b8',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '16px', fontWeight: '600',
            cursor: totalOk ? 'pointer' : 'not-allowed'
          }}
        >
          {saving ? 'Saving...' : '💾 Save All Settings'}
        </button>
      </div>

      {/* ==================== SECTION 4: SHARE CERTIFICATES ==================== */}
      <div style={{ ...sectionStyle, marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ ...sectionHeader, marginBottom: '4px' }}>📜 Share Certificates</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Issue and manage share certificates for members.</p>
          </div>
          <button onClick={() => setShowIssueModal(true)} style={btn('#0ea5e9')}>➕ Issue Certificate</button>
        </div>

        {/* Legend */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: '#475569' }}>
          <strong>Actions:</strong> <span style={{ color: '#7c3aed', fontWeight: '600' }}>📄 PDF</span> — download certificate · <span style={{ color: '#f59e0b', fontWeight: '600' }}>⊘ Cancel</span> — mark invalid, keep record · <span style={{ color: '#991b1b', fontWeight: '600' }}>🗑 Delete</span> — permanent removal
        </div>

        {/* Search */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={certSearch}
            onChange={e => setCertSearch(e.target.value)}
            placeholder="🔍 Search by certificate number, member name, or member number..."
            style={{ ...input, maxWidth: '420px' }}
          />
          {certSearch && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Showing {filteredCerts.length} of {certificates.length} certificates
            </div>
          )}
        </div>

        {/* Certificates table */}
        {filteredCerts.length === 0 ? (
          <p style={{ color: '#6b7280' }}>
            {certSearch ? `No certificates match "${certSearch}".` : 'No certificates issued yet.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0f3460', color: '#fff' }}>
                  <th style={th}>Cert #</th>
                  <th style={th}>Member</th>
                  <th style={th}>Shares</th>
                  <th style={th}>Value</th>
                  <th style={th}>Issued</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCerts.map((c, i) => (
                  <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{c.certificateNumber}</td>
                    <td style={td}>
                      {c.memberName}
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{c.memberNumber}</div>
                    </td>
                    <td style={td}>{c.totalQuantity}</td>
                    <td style={{ ...td, fontWeight: '600' }}>UGX {(c.totalValue || 0).toLocaleString()}</td>
                    <td style={td}>{new Date(c.issueDate).toLocaleDateString()}</td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: c.status === 'issued' ? '#dcfce7' : '#fee2e2',
                        color: c.status === 'issued' ? '#065f46' : '#991b1b'
                      }}>{c.status}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: '4px', whiteSpace: 'nowrap' }}>
                        <a
                          href={`${API}/api/share-certificates/${c._id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download certificate PDF"
                          style={{ padding: '5px 10px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: '600' }}
                        >📄 PDF</a>
                        {c.status === 'issued' && (
                          <button
                            onClick={() => cancelCertificate(c._id)}
                            title="Mark as cancelled. Record is kept for audit."
                            style={{ padding: '5px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                          >⊘ Cancel</button>
                        )}
                        <button
                          onClick={() => deleteCertificate(c._id, c.certificateNumber)}
                          title="PERMANENTLY delete from database. Cannot be undone."
                          style={{ padding: '5px 10px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                        >🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ISSUE MODAL */}
      {showIssueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '500px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>📜 Issue Share Certificate</h2>
              <button onClick={() => setShowIssueModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {issueMsg && (
              <div style={{
                padding: '10px', borderRadius: '8px', marginBottom: '14px',
                background: issueMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
                color: issueMsg.startsWith('✅') ? '#065f46' : '#991b1b',
                fontSize: '13px', fontWeight: '600'
              }}>{issueMsg}</div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Member *</label>
              <select value={issueMemberId} onChange={e => setIssueMemberId(e.target.value)} style={input}>
                <option value="">Select Member</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.firstName} {m.surname} ({m.memberNumber})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input type="text" value={issueNotes} onChange={e => setIssueNotes(e.target.value)} style={input} placeholder="e.g., Issued at 2026 AGM" />
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              The certificate will snapshot the member's <strong>current</strong> shares. Any shares purchased later will require a new certificate.
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={issueCertificate} disabled={issuing} style={{
                padding: '10px 20px', background: issuing ? '#94a3b8' : '#0ea5e9',
                color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600',
                cursor: issuing ? 'not-allowed' : 'pointer'
              }}>{issuing ? 'Issuing...' : 'Issue Certificate'}</button>
              <button onClick={() => setShowIssueModal(false)} style={{ padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const sectionStyle = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '24px' };
const sectionHeader = { marginTop: 0, marginBottom: '12px', fontSize: '18px', color: '#1e293b' };
const th = { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#334155', fontSize: '13px' };
const td = { padding: '10px' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '500', color: '#334155' };
const btn = (bg) => ({ padding: '10px 18px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' });