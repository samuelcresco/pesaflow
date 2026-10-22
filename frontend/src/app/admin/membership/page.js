'use client';

import { useEffect, useState } from 'react';
import PdfOptionsModal from '../../../components/PdfOptionsModal';
import { apiFetch, API } from '../../api-client';

const CANCEL_REASONS = [
  'Expelled from club',
  'Member resigned',
  'Data error',
  'Other'
];

export default function AdminMembership() {
  const [tab, setTab] = useState('overview');
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [membersStatus, setMembersStatus] = useState([]);
  const [preview, setPreview] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [debts, setDebts] = useState({ members: [], totalDebt: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfModal, setPdfModal] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOther, setCancelOther] = useState('');

  // Mark-paid modal
  const [payModal, setPayModal] = useState(null); // { member, years: [] }
  const [payYears, setPayYears] = useState([]);
  const [paySource, setPaySource] = useState('savings');

  useEffect(() => { loadAll(); }, [year]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const safe = (url) => apiFetch(url).then(r => r.json()).catch(() => null);
      const [s, ms, c, d] = await Promise.all([
        safe(`/api/membership/renewal/stats?year=${year}`),
        safe(`/api/membership/members-status?year=${year}`),
        safe(`/api/membership/certificates?year=${year}`),
        safe(`/api/membership/debt?year=${year}`)
      ]);
      setStats(s);
      setMembersStatus(Array.isArray(ms?.rows) ? ms.rows : []);
      setCertificates(Array.isArray(c?.certificates) ? c.certificates : []);
      setDebts(d || { members: [], totalDebt: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    setBusy(true);
    setMessage('⏳ Loading preview…');
    try {
      const res = await apiFetch(`/api/membership/renewal/preview?year=${year}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setPreview(d);
      setMessage('');
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const executeRenewal = async () => {
    if (!preview) return;
    if (!confirm(`Execute ${year} renewal?\n\n${preview.summary.willRenew} will be renewed\n${preview.summary.willOwe} will go into arrears\n\nThis cannot be undone.`)) return;
    setBusy(true);
    setMessage('⏳ Running renewal…');
    try {
      const res = await apiFetch('/api/membership/renewal/execute', {
        method: 'POST',
        body: JSON.stringify({ year })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Done — ${d.summary.renewed} renewed, ${d.summary.owed} into arrears, ${d.summary.skipped} skipped`);
      setPreview(null);
      await loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const issueMissing = async () => {
    if (!confirm(`Scan all paid members for ${year} and issue any missing certificates?`)) return;
    setBusy(true);
    setMessage('⏳ Issuing missing certificates…');
    try {
      const res = await apiFetch('/api/membership/certificates/issue-missing', {
        method: 'POST',
        body: JSON.stringify({ year })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Issued ${d.issued} certificate(s), ${d.skipped} already had them, ${d.errors} error(s)`);
      await loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const openPayModal = (row) => {
    // Default: check current year + all owing years
    const owingYears = row.years.filter(y => y.status === 'owed').map(y => y.year);
    setPayModal(row);
    setPayYears(owingYears);
    setPaySource('savings');
  };

  const submitMarkPaid = async () => {
    if (payYears.length === 0) { alert('Select at least one year to pay'); return; }
    setBusy(true);
    try {
      const res = await apiFetch('/api/membership/mark-paid', {
        method: 'POST',
        body: JSON.stringify({
          memberId: payModal.memberId,
          years: payYears,
          paymentSource: paySource,
          issuedBy: 'admin'
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');

      const paidCount = d.results.filter(r => r.status === 'paid').length;
      setMessage(`✅ Marked ${paidCount} year(s) as paid for ${d.memberName}`);
      setPayModal(null);
      setPayYears([]);
      await loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelReason) { alert('Choose a reason'); return; }
    if (cancelReason === 'Other' && !cancelOther.trim()) { alert('Enter a reason'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`/api/membership/certificates/${cancelModal._id}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason: cancelReason, otherReason: cancelOther, cancelledBy: 'admin' })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage(`✅ Cancelled ${cancelModal.certificateNumber}`);
      setCancelModal(null);
      setCancelReason('');
      setCancelOther('');
      await loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const waiveYear = async (memberId, year) => {
    if (!confirm(`Waive year ${year} for this member?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/membership/waive', {
        method: 'POST',
        body: JSON.stringify({ memberId, year })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMessage('✅ ' + d.message);
      await loadAll();
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const filteredCerts = certificates.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.memberName || '').toLowerCase().includes(q) ||
        (c.memberNumber || '').toLowerCase().includes(q) ||
        (c.certificateNumber || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredMembers = membersStatus.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.memberNumber.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0 }}>🎫 Membership</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Renewals, arrears, certificates — all in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#64748b' }}>Year:</label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100px' }}
          />
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px', borderRadius: '8px', marginBottom: '16px',
          background: message.startsWith('✅') ? '#dcfce7' : message.startsWith('⏳') ? '#fef9e7' : '#fee2e2',
          color: message.startsWith('✅') ? '#065f46' : message.startsWith('⏳') ? '#b45309' : '#991b1b',
          fontWeight: 600
        }}>{message}</div>
      )}

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'members', label: '✅ Members Status' },
          { id: 'renewal', label: '🔄 Run Renewal' },
          { id: 'certificates', label: '📜 Certificates' },
          { id: 'debt', label: '⚠️ Arrears' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? '3px solid #2563eb' : '3px solid transparent',
            color: tab === t.id ? '#1e293b' : '#64748b',
            fontWeight: tab === t.id ? '600' : '500',
            cursor: 'pointer', marginBottom: '-2px', fontSize: '14px'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {tab === 'overview' && (
        <div>
          {!stats ? <p style={{ color: '#64748b' }}>Loading…</p> : (
            <>
              {(stats.renewalFee <= 0 && stats.firstTimeFee <= 0) && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '14px', borderRadius: '10px', marginBottom: '16px', color: '#78350f', fontSize: '13px' }}>
                  ⚠️ No membership fees configured for <strong>{year}</strong>. Set them in <strong>Savings → Savings Settings</strong> first.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                <BigStat label="First-time Fee" value={stats.firstTimeFee} color="#7c3aed" bg="#f3e8ff" money />
                <BigStat label="Renewal Fee" value={stats.renewalFee} color="#0f3460" bg="#e0e7ff" money />
                <BigStat label={`Renewed ${year}`} value={stats.renewedCount} color="#15803d" bg="#dcfce7" />
                <BigStat label="Not Yet Renewed" value={stats.notYetRenewed} color="#b45309" bg="#fef9e7" />
                <BigStat label="Collected This Year" value={stats.totalCollected} color="#0369a1" bg="#e0f2fe" money />
                <BigStat label="Total Arrears" value={stats.totalArrears} color="#dc2626" bg="#fee2e2" money />
                <BigStat label="Members With Arrears" value={stats.membersWithArrears} color="#991b1b" bg="#fecaca" />
                <BigStat label="Total Active Members" value={stats.activeMembers} color="#475569" bg="#f1f5f9" />
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={issueMissing}
                  disabled={busy}
                  style={{ padding: '12px 22px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                  📜 Issue Missing Certificates for {year}
                </button>
                <button
                  onClick={() => setTab('renewal')}
                  style={{ padding: '12px 22px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  🔄 Run Renewal
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== MEMBERS STATUS ==================== */}
      {tab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>✅ Members Status — {year}</h2>
            <input
              type="text"
              placeholder="Search by name or member number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '280px' }}
            />
          </div>

          {filteredMembers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <p style={{ color: '#64748b' }}>No members found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={thL}>Member No</th>
                    <th style={thL}>Name</th>
                    <th style={thL}>Years (Status)</th>
                    <th style={thL}>Arrears</th>
                    <th style={thL}>Current Year</th>
                    <th style={thL}>Certificate</th>
                    <th style={thL}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(r => (
                    <tr key={r.memberId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdL}>{r.memberNumber}</td>
                      <td style={tdL}>{r.name}</td>
                      <td style={tdL}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {r.years.map(y => (
                            <span key={y.year} style={{
                              padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                              background: y.status === 'paid' ? '#dcfce7' : y.status === 'waived' ? '#e0e7ff' : '#fee2e2',
                              color: y.status === 'paid' ? '#065f46' : y.status === 'waived' ? '#4f46e5' : '#991b1b'
                            }}>
                              {y.year}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...tdL, color: r.arrearsTotal > 0 ? '#dc2626' : '#64748b', fontWeight: r.arrearsTotal > 0 ? 700 : 400 }}>
                        {r.arrearsTotal > 0 ? `UGX ${Number(r.arrearsTotal).toLocaleString()} (${r.arrearsYears.join(', ')})` : '—'}
                      </td>
                      <td style={tdL}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: r.currentYearStatus === 'paid' ? '#dcfce7' : r.currentYearStatus === 'waived' ? '#e0e7ff' : '#fee2e2',
                          color: r.currentYearStatus === 'paid' ? '#065f46' : r.currentYearStatus === 'waived' ? '#4f46e5' : '#991b1b'
                        }}>{r.currentYearStatus.toUpperCase()}</span>
                      </td>
                      <td style={tdL}>
                        {r.currentYearCertificate ? (
                          <button
                            onClick={() => setPdfModal({
                              title: `Certificate — ${r.currentYearCertificate.certificateNumber}`,
                              url: `${API}/api/membership/certificates/${r.currentYearCertificate._id}/pdf`
                            })}
                            style={btnMini('#2563eb')}
                          >📄 PDF</button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>None</span>
                        )}
                      </td>
                      <td style={tdL}>
                        <button
                          onClick={() => openPayModal(r)}
                          disabled={busy || r.years.every(y => y.status !== 'owed')}
                          style={{
                            ...btnMini('#16a34a'),
                            opacity: r.years.every(y => y.status !== 'owed') ? 0.4 : 1,
                            cursor: r.years.every(y => y.status !== 'owed') ? 'not-allowed' : 'pointer'
                          }}
                        >💰 Mark Paid</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== RUN RENEWAL ==================== */}
      {tab === 'renewal' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0 }}>🔄 Run {year} Renewal</h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Deducts the renewal fee from each active member's savings. Members without enough savings go into arrears.
              </p>
            </div>
            <button
              onClick={runPreview}
              disabled={busy}
              style={{ padding: '10px 22px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
            >
              {busy ? '⏳' : '🔍'} Preview Renewal
            </button>
          </div>

          {preview ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <BigStat label="Will Renew" value={preview.summary.willRenew} color="#15803d" bg="#dcfce7" />
                <BigStat label="Will Owe" value={preview.summary.willOwe} color="#b45309" bg="#fef9e7" />
                <BigStat label="Already Paid" value={preview.summary.alreadyPaid} color="#0369a1" bg="#e0f2fe" />
                <BigStat label="Total To Collect" value={preview.summary.totalToCollect} color="#0f3460" bg="#e0e7ff" money />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={executeRenewal}
                  disabled={busy || preview.summary.willRenew === 0}
                  style={{
                    padding: '12px 26px', background: '#16a34a', color: '#fff', border: 'none',
                    borderRadius: '8px', fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: (busy || preview.summary.willRenew === 0) ? 0.5 : 1
                  }}
                >✅ Execute {year} Renewal</button>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0f3460', color: '#fff' }}>
                      <th style={thL}>Member No</th>
                      <th style={thL}>Name</th>
                      <th style={thL}>Available</th>
                      <th style={thL}>Fee</th>
                      <th style={thL}>Status</th>
                      <th style={thL}>Debt After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.memberId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={tdL}>{r.memberNumber}</td>
                        <td style={tdL}>{r.name}</td>
                        <td style={tdL}>UGX {Number(r.availableSavings).toLocaleString()}</td>
                        <td style={tdL}>UGX {Number(r.fee).toLocaleString()}</td>
                        <td style={tdL}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                            background: r.status === 'will_renew' ? '#dcfce7' : r.status === 'will_owe' ? '#fee2e2' : '#e0f2fe',
                            color: r.status === 'will_renew' ? '#065f46' : r.status === 'will_owe' ? '#991b1b' : '#0369a1'
                          }}>{r.status.replace('_', ' ').toUpperCase()}</span>
                        </td>
                        <td style={{ ...tdL, color: r.debtAmount > 0 ? '#dc2626' : '#64748b', fontWeight: r.debtAmount > 0 ? 700 : 400 }}>
                          {r.debtAmount > 0 ? `UGX ${Number(r.debtAmount).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔍</div>
              <p style={{ color: '#64748b', margin: 0 }}>Click <strong>Preview Renewal</strong> to see what will happen.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== CERTIFICATES ==================== */}
      {tab === 'certificates' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>📜 Certificates — {year}</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', width: '220px' }}
              />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px' }}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={issueMissing}
                disabled={busy}
                style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: busy ? 'wait' : 'pointer' }}
              >📜 Issue Missing</button>
            </div>
          </div>

          {filteredCerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📜</div>
              <p style={{ color: '#64748b', margin: 0 }}>No certificates for {year} yet.</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px' }}>Click <strong>📜 Issue Missing</strong> if some members have paid but have no certificate.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={thL}>Certificate No</th>
                    <th style={thL}>Member</th>
                    <th style={thL}>Year</th>
                    <th style={thL}>Type</th>
                    <th style={thL}>Valid Until</th>
                    <th style={thL}>Status</th>
                    <th style={thL}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.map(c => (
                    <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdL, fontFamily: 'monospace', fontWeight: 600 }}>{c.certificateNumber}</td>
                      <td style={tdL}>
                        <div style={{ fontWeight: 600 }}>{c.memberName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.memberNumber}</div>
                      </td>
                      <td style={tdL}>{c.year}</td>
                      <td style={tdL}>{c.membershipType === 'first_time' ? 'First-time' : 'Renewal'}</td>
                      <td style={tdL}>{new Date(c.validTo).toLocaleDateString()}</td>
                      <td style={tdL}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: c.status === 'active' ? '#dcfce7' : '#fee2e2',
                          color: c.status === 'active' ? '#065f46' : '#991b1b'
                        }}>{c.status.toUpperCase()}</span>
                        {c.status === 'cancelled' && c.cancelledReason && (
                          <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '3px' }}>{c.cancelledReason}</div>
                        )}
                      </td>
                      <td style={tdL}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => setPdfModal({
                              title: `Certificate — ${c.certificateNumber}`,
                              url: `${API}/api/membership/certificates/${c._id}/pdf`
                            })}
                            style={btnMini('#2563eb')}
                          >📄 PDF</button>
                          {c.status === 'active' && (
                            <button onClick={() => { setCancelModal(c); setCancelReason(''); setCancelOther(''); }} style={btnMini('#dc2626')}>❌ Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== ARREARS ==================== */}
      {tab === 'debt' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>⚠️ Arrears — Unpaid Prior Years</h2>
            <div style={{ fontSize: '14px', color: '#334155' }}>
              Total owed: <strong style={{ color: '#dc2626' }}>UGX {Number(debts.totalDebt || 0).toLocaleString()}</strong>
              <span style={{ marginLeft: '10px', color: '#64748b' }}>({debts.count} members)</span>
            </div>
          </div>

          {debts.members.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#dcfce7', borderRadius: '12px', border: '1px dashed #86efac' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
              <p style={{ color: '#065f46', margin: 0 }}>No arrears. Everyone is up to date.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff' }}>
                    <th style={thL}>Member No</th>
                    <th style={thL}>Name</th>
                    <th style={thL}>Contact</th>
                    <th style={thL}>Savings</th>
                    <th style={thL}>Owed Years</th>
                    <th style={thL}>Total Owed</th>
                    <th style={thL}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.members.map(m => (
                    <tr key={m.memberId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdL}>{m.memberNumber}</td>
                      <td style={tdL}>{m.name}</td>
                      <td style={tdL}>{m.contact || '—'}</td>
                      <td style={tdL}>UGX {Number(m.savings || 0).toLocaleString()}</td>
                      <td style={tdL}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {m.owedYears.map(y => (
                            <span key={y.year} style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>
                              {y.year} — {Number(y.fee).toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...tdL, color: '#dc2626', fontWeight: 700 }}>UGX {Number(m.totalOwed).toLocaleString()}</td>
                      <td style={tdL}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {m.owedYears.map(y => (
                            <button key={y.year} onClick={() => waiveYear(m.memberId, y.year)} style={btnMini('#7c3aed')}>✓ Waive {y.year}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== PDF MODAL ==================== */}
      {pdfModal && <PdfOptionsModal title={pdfModal.title} baseUrl={pdfModal.url} onClose={() => setPdfModal(null)} />}

      {/* ==================== CANCEL MODAL ==================== */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '460px', maxWidth: '92vw' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Cancel Certificate</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              {cancelModal.certificateNumber} — {cancelModal.memberName}
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Reason</label>
            <select
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box' }}
            >
              <option value="">— choose —</option>
              {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {cancelReason === 'Other' && (
              <textarea
                value={cancelOther}
                onChange={e => setCancelOther(e.target.value)}
                placeholder="Enter reason…"
                rows="2"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box' }}
              />
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCancelModal(null)} disabled={busy} style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitCancel} disabled={busy} style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MARK PAID MODAL ==================== */}
      {payModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '540px', maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>💰 Mark Membership Paid</h2>
              <button onClick={() => { setPayModal(null); setPayYears([]); }} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px 0' }}>
              {payModal.name} — {payModal.memberNumber}
            </p>

            <div style={{ background: '#e0f2fe', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#0369a1' }}>
              <strong>Available Savings:</strong> UGX {Number(payModal.availableSavings).toLocaleString()}
            </div>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Years to Pay</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {payModal.years.map(y => {
                const disabled = y.status !== 'owed';
                const checked = payYears.includes(y.year);
                return (
                  <label key={y.year} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                    border: `1px solid ${checked ? '#16a34a' : '#e5e7eb'}`,
                    background: checked ? '#dcfce7' : disabled ? '#f8fafc' : '#fff',
                    borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={e => {
                        if (e.target.checked) setPayYears([...payYears, y.year]);
                        else setPayYears(payYears.filter(py => py !== y.year));
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{y.year}</strong> — UGX {Number(y.fee).toLocaleString()}
                      {y.status === 'paid' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#065f46' }}>✓ already paid</span>}
                      {y.status === 'waived' && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#4f46e5' }}>waived</span>}
                    </span>
                  </label>
                );
              })}
            </div>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Payment Source</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <label style={{ flex: 1, padding: '10px', border: `2px solid ${paySource === 'savings' ? '#2563eb' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: paySource === 'savings' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px' }}>
                <input type="radio" checked={paySource === 'savings'} onChange={() => setPaySource('savings')} style={{ display: 'none' }} />
                💰 From Savings
              </label>
              <label style={{ flex: 1, padding: '10px', border: `2px solid ${paySource === 'cash' ? '#2563eb' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: paySource === 'cash' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px' }}>
                <input type="radio" checked={paySource === 'cash'} onChange={() => setPaySource('cash')} style={{ display: 'none' }} />
                💵 Cash
              </label>
            </div>

            <div style={{ background: '#0f3460', color: '#fff', padding: '14px 18px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px' }}>Total Due</span>
              <span style={{ fontSize: '20px', fontWeight: 800 }}>
                UGX {payModal.years
                  .filter(y => payYears.includes(y.year))
                  .reduce((s, y) => s + Number(y.fee || 0), 0)
                  .toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setPayModal(null); setPayYears([]); }} disabled={busy} style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitMarkPaid} disabled={busy || payYears.length === 0} style={{
                padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer', opacity: (busy || payYears.length === 0) ? 0.5 : 1
              }}>
                {busy ? 'Saving…' : '✅ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BigStat = ({ label, value, color, bg, money }) => (
  <div style={{ background: bg, padding: '16px 18px', borderRadius: '12px', border: `1px solid ${color}30` }}>
    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 800, color, lineHeight: 1.1 }}>
      {money ? `UGX ${Number(value || 0).toLocaleString()}` : (value ?? 0)}
    </div>
  </div>
);

const thL = { padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '12px' };
const tdL = { padding: '10px' };
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 });