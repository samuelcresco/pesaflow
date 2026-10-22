'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PdfOptionsModal from '../../components/PdfOptionsModal';
import { apiFetch, API } from '../api-client';

export default function MemberDashboard() {
  const router = useRouter();
  const [member, setMember] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savings, setSavings] = useState(null);
  const [shares, setShares] = useState(null);
  const [shareRequests, setShareRequests] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ shareType: 'golden', quantity: 1, paymentMethod: 'cash' });
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [shareSettings, setShareSettings] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loanEligibility, setLoanEligibility] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({ type: 'emergency', amount: '', duration: 3, scheduleUnit: 'weekly', purpose: '' });
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [dividends, setDividends] = useState({ history: [], total: 0 });
  const [divSummary, setDivSummary] = useState(null);
  const [divLoading, setDivLoading] = useState(true);
  const [showDivAction, setShowDivAction] = useState(null); // 'withdraw' | 'to_shares' | 'to_savings' | 'donate'
  const [divForm, setDivForm] = useState({ amount: '', shareType: 'golden', quantity: 1 });
  const [divBusy, setDivBusy] = useState(false);
  const [divMsg, setDivMsg] = useState('');
  const [withdrawals, setWithdrawals] = useState({ withdrawals: [], totalPaid: 0 });
  const [certificates, setCertificates] = useState({ certificates: [], total: 0 });
  const [clubStats, setClubStats] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [constitution, setConstitution] = useState(null);
  const [constitutionRefreshing, setConstitutionRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = localStorage.getItem('member');
    if (!data) { router.replace('/member-login'); return; }
    const m = JSON.parse(data);
    setMember(m);
    fetchAll(m.id);
  }, [router]);

  useEffect(() => {
    if (!member) return;
    const t = setInterval(() => {
      apiFetch('/api/member/club-stats').then(r => r.json()).then(d => setClubStats(d)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [member]);

  useEffect(() => {
    if (!member) return;
    const refresh = () => {
      apiFetch(`/api/member/constitution/status?memberId=${member.id}&_t=${Date.now()}`)
        .then(r => r.json()).then(d => setConstitution(d)).catch(() => {});
    };
    refresh();
    const t = setInterval(refresh, 15000);
    const vis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [member]);

  const fetchAll = async (id) => {
    try {
      const safe = (url) => apiFetch(url).then(r => r.json()).catch(() => null);
      const [p, s, sh, req, sett, l, dsum, dhist, w, cert, c, lead, elig, con] = await Promise.all([
        safe(`/api/member/me/${id}`),
        safe(`/api/member/me/${id}/savings`),
        safe(`/api/member/me/${id}/shares`),
        safe(`/api/share-requests/member/${id}`),
        safe('/api/settings/shares'),
        safe(`/api/member/me/${id}/loans`),
        safe(`/api/member/me/${id}/dividend-summary`),
        safe(`/api/member/me/${id}/dividend-history`),
        safe(`/api/withdrawals/member/${id}`),
        safe(`/api/share-certificates/member/${id}`),
        safe('/api/member/club-stats'),
        safe('/api/member/leaders'),
        safe(`/api/loans/eligibility/${id}/emergency`),
        safe(`/api/member/constitution/status?memberId=${id}&_t=${Date.now()}`)
      ]);
      setProfile(p);
      setSavings(s);
      setShares(sh);
      setShareRequests(Array.isArray(req) ? req : []);
      setShareSettings(sett);
      setLoans(Array.isArray(l) ? l : []);
      setDivSummary(dsum);
      setDividends(dhist || { history: [], total: 0 });
      setWithdrawals(w || { withdrawals: [], totalPaid: 0 });
      setCertificates(cert || { certificates: [], total: 0 });
      setClubStats(c);
      setLeaders(Array.isArray(lead) ? lead : []);
      setLoanEligibility(elig);
      setConstitution(con);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setDivLoading(false); }
  };

  const refreshShares = async () => {
    if (!member) return;
    const [sh, req] = await Promise.all([
      apiFetch(`/api/member/me/${member.id}/shares`).then(r => r.json()).catch(() => null),
      apiFetch(`/api/share-requests/member/${member.id}`).then(r => r.json()).catch(() => [])
    ]);
    setShares(sh);
    setShareRequests(Array.isArray(req) ? req : []);
  };

  const refreshDividends = async () => {
    if (!member) return;
    const [dsum, dhist] = await Promise.all([
      apiFetch(`/api/member/me/${member.id}/dividend-summary`).then(r => r.json()).catch(() => null),
      apiFetch(`/api/member/me/${member.id}/dividend-history`).then(r => r.json()).catch(() => ({ history: [], total: 0 }))
    ]);
    setDivSummary(dsum);
    setDividends(dhist || { history: [], total: 0 });
  };

  const refreshLoans = async () => {
    if (!member) return;
    const [l, elig] = await Promise.all([
      apiFetch(`/api/member/me/${member.id}/loans`).then(r => r.json()).catch(() => []),
      apiFetch(`/api/loans/eligibility/${member.id}/emergency`).then(r => r.json()).catch(() => null)
    ]);
    setLoans(Array.isArray(l) ? l : []);
    setLoanEligibility(elig);
  };

  const refreshClubStats = async () => {
    try {
      const r = await apiFetch(`/api/member/club-stats?_t=${Date.now()}`);
      setClubStats(await r.json());
    } catch {}
  };

  const refreshConstitution = useCallback(async () => {
    if (!member) return;
    setConstitutionRefreshing(true);
    try {
      const r = await apiFetch(`/api/member/constitution/status?memberId=${member.id}&_t=${Date.now()}`);
      setConstitution(await r.json());
    } catch {}
    finally { setTimeout(() => setConstitutionRefreshing(false), 300); }
  }, [member]);

  // ==================== DIVIDEND ACTIONS ====================
  const openDivAction = (action) => {
    setShowDivAction(action);
    setDivMsg('');
    const bal = divSummary?.dividendBalance || 0;
    setDivForm({ amount: String(bal), shareType: 'golden', quantity: 1 });
  };

  const submitDivAction = async (e) => {
    e.preventDefault();
    setDivMsg('');
    const action = showDivAction;
    if (!action) return;

    let body = { action };
    if (action === 'withdraw' || action === 'to_savings' || action === 'donate') {
      const amt = Number(divForm.amount) || 0;
      if (amt <= 0) { setDivMsg('❌ Enter a valid amount'); return; }
      body.amount = amt;
    } else if (action === 'to_shares') {
      const qty = parseInt(divForm.quantity) || 0;
      if (qty <= 0) { setDivMsg('❌ Enter a valid quantity'); return; }
      body.shareType = divForm.shareType;
      body.quantity = qty;
    }

    setDivBusy(true);
    try {
      const res = await apiFetch(`/api/member/me/${member.id}/use-dividends`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setDivMsg('✅ ' + d.message);
      setTimeout(async () => {
        setShowDivAction(null);
        setDivMsg('');
        await Promise.all([refreshDividends(), refreshShares()]);
      }, 2000);
    } catch (err) {
      setDivMsg('❌ ' + err.message);
    } finally {
      setDivBusy(false);
    }
  };

  const submitShareApplication = async (e) => {
    e.preventDefault();
    setShareMsg('');
    const qty = parseInt(shareForm.quantity) || 0;
    if (qty <= 0) { setShareMsg('❌ Quantity must be greater than 0'); return; }

    setSharing(true);
    try {
      const res = await apiFetch(`/api/share-requests/member/${member.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          shareType: shareForm.shareType,
          quantity: qty,
          paymentMethod: shareForm.paymentMethod
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setShareMsg('✅ Share request submitted! Awaiting admin approval.');
      setTimeout(async () => {
        setShowShareModal(false);
        setShareForm({ shareType: 'golden', quantity: 1, paymentMethod: 'cash' });
        setShareMsg('');
        await refreshShares();
      }, 2200);
    } catch (err) {
      setShareMsg('❌ ' + err.message);
    } finally {
      setSharing(false);
    }
  };

  const submitLoanApplication = async (e) => {
    e.preventDefault();
    setApplyMessage('');
    const limit = loanEligibility?.maxAmount || 0;
    const amt = Number(applyForm.amount) || 0;
    if (loanEligibility?.hasActiveLoan) { setApplyMessage('❌ You already have an active loan'); return; }
    if (amt <= 0) { setApplyMessage('❌ Enter a valid amount'); return; }
    if (amt > limit) { setApplyMessage(`❌ Amount exceeds your limit of UGX ${limit.toLocaleString()}`); return; }

    setApplying(true);
    try {
      const res = await apiFetch(`/api/member/me/${member.id}/apply-loan`, {
        method: 'POST',
        body: JSON.stringify({
          type: applyForm.type, amount: amt,
          duration: Number(applyForm.duration) || 1,
          scheduleUnit: applyForm.scheduleUnit,
          purpose: applyForm.purpose
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Application failed');
      setApplyMessage('✅ Loan application submitted! Awaiting admin approval.');
      setTimeout(async () => {
        setShowApplyModal(false);
        setApplyForm({ type: 'emergency', amount: '', duration: 3, scheduleUnit: 'weekly', purpose: '' });
        setApplyMessage('');
        await refreshLoans();
      }, 2200);
    } catch (err) {
      setApplyMessage('❌ ' + err.message);
    } finally { setApplying(false); }
  };

  const logout = () => {
    localStorage.removeItem('member');
    localStorage.removeItem('token');
    router.replace('/member-login');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;
  if (!member) return null;

  const totalBorrowed = loans.reduce((s, l) => s + Number(l.amount || 0), 0);
  const totalPaid = loans.reduce((s, l) => s + Number(l.paidAmount || 0), 0);
  const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstandingBalance || 0), 0);
  const activeLoan = loans.find(l => ['disbursed', 'active'].includes(l.status));
  const activeOutstanding = activeLoan ? Number(activeLoan.outstandingBalance || 0) : 0;

  const sharePrices = shareSettings?.shareTypes || {};
  const shareTypesList = [
    { key: 'platinum', label: 'Platinum', color: '#e6b800', bg: '#fef9e7', setKey: 'platinum' },
    { key: 'golden',   label: 'Golden',   color: '#b8860b', bg: '#fef3c7', setKey: 'golden'   },
    { key: 'silver',   label: 'Silver',   color: '#64748b', bg: '#f1f5f9', setKey: 'silver'   },
    { key: 'bronze',   label: 'Ordinary', color: '#c2410c', bg: '#ffedd5', setKey: 'ordinary' }
  ];
  const totalShareQty = shareTypesList.reduce((s, t) => s + Number(shares?.shares?.[t.key]?.quantity || 0), 0);

  const tabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'profile', label: '👤 Profile' },
    { id: 'savings', label: '💰 Savings' },
    { id: 'shares', label: '📊 Shares' },
    { id: 'certificates', label: '📜 Certificates' },
    { id: 'loans', label: '🏦 Loans' },
    { id: 'dividends', label: '💵 Dividends' },
    { id: 'withdraw', label: '💸 Withdraw' },
    { id: 'club', label: '🏛️ Club Stats' },
    { id: 'constitution', label: '📖 Constitution' },
    { id: 'contacts', label: '📞 Contacts' },
    { id: 'password', label: '🔒 Password' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Welcome, {member.name}!</h2>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Member No: <strong>{member.memberNumber}</strong></div>
        </div>
        <button onClick={logout} style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: tab === t.id ? '3px solid #2563eb' : '3px solid transparent',
            color: tab === t.id ? '#1e293b' : '#64748b',
            fontWeight: tab === t.id ? '600' : '500',
            cursor: 'pointer', marginBottom: '-2px', fontSize: '14px'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <h2>Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Card title="My Savings" value={savings?.totals?.total || 0} color="#15803d" bg="#dcfce7" icon="💰" />
            <Card title="My Shares" value={shares?.totalValue || 0} color="#7c3aed" bg="#f3e8ff" icon="📊" />
            <Card title="Dividends" value={divSummary?.dividendBalance || 0} color="#0891b2" bg="#cffafe" icon="💵" />
            <Card title="Certificates" value={(certificates?.certificates || []).filter(c => c.status === 'issued').length} color="#c9a227" bg="#fef9e7" icon="📜" raw />
          </div>
        </div>
      )}

      {tab === 'profile' && profile && (
        <div>
          <h2>My Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Info label="First Name" value={profile.firstName} />
            <Info label="Surname" value={profile.surname} />
            <Info label="Member Number" value={profile.memberNumber} />
            <Info label="Contact" value={profile.contact} />
            <Info label="Email" value={profile.email} />
            <Info label="Address" value={profile.address} />
          </div>
        </div>
      )}

      {tab === 'savings' && savings && (
        <div>
          <h2>My Savings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <Card title="Monthly" value={savings.totals?.monthly || 0} color="#0369a1" bg="#e0f2fe" />
            <Card title="Extra" value={savings.totals?.extra || 0} color="#15803d" bg="#dcfce7" />
            <Card title="Total" value={savings.totals?.total || 0} color="#7c3aed" bg="#f3e8ff" />
            <Card title="Locked" value={savings.totals?.locked || 0} color="#dc2626" bg="#fee2e2" />
          </div>
        </div>
      )}

      {tab === 'shares' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>📊 My Shares</h2>
            <button onClick={() => setShowShareModal(true)} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>➕ Apply for Shares</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {shareTypesList.map(t => {
              const owned = Number(shares?.shares?.[t.key]?.quantity || 0);
              const price = Number(sharePrices?.[t.setKey]?.price || 0);
              const maxShares = Number(sharePrices?.[t.setKey]?.maxShares || 15);
              const value = owned * price;
              return (
                <div key={t.key} style={{ background: t.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${t.color}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: t.color, textTransform: 'uppercase' }}>{t.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>UGX {price.toLocaleString()} each</div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: t.color, lineHeight: 1 }}>
                    {owned}<span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 500 }}> / {maxShares}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>Value: <strong>UGX {value.toLocaleString()}</strong></div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#0f3460', color: '#fff', padding: '18px 22px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>Total Shares</div>
              <div style={{ fontSize: '26px', fontWeight: 800 }}>{totalShareQty} <span style={{ fontSize: '16px', opacity: 0.6 }}>/ 15</span></div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.75 }}>Total Value</div>
              <div style={{ fontSize: '26px', fontWeight: 800 }}>UGX {Number(shares?.totalValue || 0).toLocaleString()}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '15px', color: '#334155', marginBottom: '8px' }}>My Share Requests</h3>
          {shareRequests.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>You have no share requests yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  <th style={thL}>Type</th><th style={thL}>Qty</th><th style={thL}>Amount</th><th style={thL}>Method</th><th style={thL}>Status</th><th style={thL}>Date</th>
                </tr></thead>
                <tbody>
                  {shareRequests.map(r => (
                    <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdL}>{r.shareType}</td><td style={tdL}>{r.quantity}</td>
                      <td style={tdL}>UGX {Number(r.amountDue || 0).toLocaleString()}</td>
                      <td style={tdL}>{r.paymentMethod}</td>
                      <td style={tdL}><span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef9e7',
                        color: r.status === 'approved' ? '#065f46' : r.status === 'rejected' ? '#991b1b' : '#b45309'
                      }}>{r.status.toUpperCase()}</span></td>
                      <td style={tdL}>{new Date(r.requestedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'certificates' && (
        <div>
          <h2>📜 My Share Certificates</h2>
          {(certificates?.certificates || []).length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📜</div>
              <p style={{ color: '#64748b', margin: 0 }}>No certificates issued yet.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {certificates.certificates.map(c => {
                const isCancelled = c.status === 'cancelled';
                return (
                  <div key={c._id} style={{ background: isCancelled ? '#fef2f2' : '#fff', border: `2px solid ${isCancelled ? '#fca5a5' : '#c9a227'}`, borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Certificate</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f3460', fontFamily: 'monospace' }}>{c.certificateNumber}</div>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: isCancelled ? '#fee2e2' : '#dcfce7', color: isCancelled ? '#991b1b' : '#065f46' }}>
                        {isCancelled ? '❌ CANCELLED' : '✅ ACTIVE'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#334155', marginBottom: '10px' }}>
                      <div><strong>Shares:</strong> {c.totalQuantity}</div>
                      <div><strong>Value:</strong> UGX {Number(c.totalValue || 0).toLocaleString()}</div>
                      <div><strong>Issued:</strong> {new Date(c.issueDate).toLocaleDateString()}</div>
                    </div>
                    {isCancelled && (
                      <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>⚠️ Certificate Cancelled</div>
                        <div><strong>Reason:</strong> {c.cancelledReason || '—'}</div>
                        {c.cancelledAt && <div><strong>Date:</strong> {new Date(c.cancelledAt).toLocaleDateString()}</div>}
                      </div>
                    )}
                    {!isCancelled && (
                      <button onClick={() => setPdfModal({ title: `Share Certificate — ${c.certificateNumber}`, url: `${API}/api/share-certificates/${c._id}/pdf` })} style={{ width: '100%', padding: '10px', background: '#0f3460', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        📄 Download Certificate PDF
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== DIVIDENDS TAB ==================== */}
      {tab === 'dividends' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>💵 My Dividends</h2>
            <button onClick={refreshDividends} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🔄 Refresh</button>
          </div>

          {divLoading || !divSummary ? (
            <p style={{ color: '#64748b' }}>Loading dividends…</p>
          ) : (
            <>
              {/* Balance cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', color: '#fff', padding: '20px 22px', borderRadius: '14px', boxShadow: '0 8px 20px rgba(8,145,178,0.25)' }}>
                  <div style={{ fontSize: '12px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1px' }}>💰 Dividend Balance</div>
                  <div style={{ fontSize: '30px', fontWeight: 800, marginTop: '4px' }}>UGX {Number(divSummary.dividendBalance || 0).toLocaleString()}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                    {divSummary.window?.open ? '🟢 Withdrawals open' : '🔴 Withdrawals closed'}
                  </div>
                </div>
                <StatCard label="Total Received" value={divSummary.totalDividendsReceived} color="#15803d" bg="#dcfce7" />
                <StatCard label="Total Withdrawn" value={divSummary.totalDividendsWithdrawn} color="#b45309" bg="#fef9e7" />
                <StatCard label="My Savings" value={divSummary.savings} color="#0369a1" bg="#e0f2fe" />
              </div>

              {/* Window status */}
              <div style={{
                background: divSummary.window?.open ? '#dcfce7' : '#fef9e7',
                border: `1px solid ${divSummary.window?.open ? '#86efac' : '#fcd34d'}`,
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '13px',
                color: divSummary.window?.open ? '#065f46' : '#78350f'
              }}>
                {divSummary.window?.open ? (
                  <>✅ <strong>Dividend withdrawal window is OPEN.</strong> You can withdraw, buy shares, add to savings or donate.</>
                ) : (
                  <>🔒 <strong>Dividend withdrawal window is CLOSED.</strong> Open between: <strong>{divSummary.window?.label || '—'}</strong></>
                )}
              </div>

              {/* Use my dividends — action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                <ActionBtn
                  icon="💸" label="Withdraw to Cash"
                  disabled={!divSummary.window?.open || divSummary.dividendBalance <= 0}
                  onClick={() => openDivAction('withdraw')}
                  color="#dc2626"
                />
                <ActionBtn
                  icon="📊" label="Buy More Shares"
                  disabled={!divSummary.window?.open || divSummary.dividendBalance <= 0}
                  onClick={() => openDivAction('to_shares')}
                  color="#7c3aed"
                />
                <ActionBtn
                  icon="💰" label="Add to Savings"
                  disabled={!divSummary.window?.open || divSummary.dividendBalance <= 0}
                  onClick={() => openDivAction('to_savings')}
                  color="#15803d"
                />
                <ActionBtn
                  icon="🏛️" label="Donate to Club"
                  disabled={!divSummary.window?.open || divSummary.dividendBalance <= 0}
                  onClick={() => openDivAction('donate')}
                  color="#c9a227"
                />
              </div>

              {/* Distribution breakdown */}
              <h3 style={{ fontSize: '15px', color: '#334155', marginBottom: '8px' }}>📊 This Year's Distribution Breakdown</h3>
              {divSummary.referencePool > 0 ? (
                <>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    Based on last distribution pool of <strong>UGX {Number(divSummary.referencePool).toLocaleString()}</strong>
                    {divSummary.lastDistributionDate && ` on ${new Date(divSummary.lastDistributionDate).toLocaleDateString()}`}
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0f3460', color: '#fff' }}>
                          <th style={thL}>Share Type</th>
                          <th style={thL}>My Shares</th>
                          <th style={thL}>Club Total</th>
                          <th style={thL}>My %</th>
                          <th style={thL}>Pool %</th>
                          <th style={thL}>Pool Amount</th>
                          <th style={thL}>My Dividend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divSummary.breakdown?.map(b => (
                          <tr key={b.type} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ ...tdL, textTransform: 'capitalize', fontWeight: 600 }}>{b.type === 'bronze' ? 'Ordinary' : b.type}</td>
                            <td style={tdL}>{b.myShares}</td>
                            <td style={tdL}>{b.clubShares}</td>
                            <td style={tdL}>{b.myPercentOfType.toFixed(2)}%</td>
                            <td style={tdL}>{b.poolPercent}%</td>
                            <td style={tdL}>UGX {Number(b.poolAmount).toLocaleString()}</td>
                            <td style={{ ...tdL, fontWeight: 700, color: '#0891b2' }}>UGX {Number(b.projectedDividend).toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#cffafe', fontWeight: 700 }}>
                          <td style={tdL} colSpan={6}>TOTAL PROJECTED</td>
                          <td style={{ ...tdL, color: '#0e7490' }}>UGX {Number(divSummary.totalProjected).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>No dividend distributions have been made yet.</p>
              )}

              {/* History */}
              <h3 style={{ fontSize: '15px', color: '#334155', marginBottom: '8px' }}>📜 My Distribution History</h3>
              {(dividends?.history || []).length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>No distributions yet.</p>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={thL}>Date</th>
                        <th style={thL}>From Platinum</th>
                        <th style={thL}>From Golden</th>
                        <th style={thL}>From Silver</th>
                        <th style={thL}>From Ordinary</th>
                        <th style={thL}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dividends.history.map(h => (
                        <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={tdL}>{new Date(h.date).toLocaleDateString()}</td>
                          <td style={tdL}>UGX {Number(h.myShare.fromPlatinum).toLocaleString()}</td>
                          <td style={tdL}>UGX {Number(h.myShare.fromGolden).toLocaleString()}</td>
                          <td style={tdL}>UGX {Number(h.myShare.fromSilver).toLocaleString()}</td>
                          <td style={tdL}>UGX {Number(h.myShare.fromBronze).toLocaleString()}</td>
                          <td style={{ ...tdL, fontWeight: 700, color: '#0891b2' }}>UGX {Number(h.myShare.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'loans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>🏦 My Loans</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={refreshLoans} style={{ padding: '8px 16px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🔄 Refresh</button>
              {!loanEligibility?.hasActiveLoan && (
                <button onClick={() => setShowApplyModal(true)} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>➕ Apply for Loan</button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <StatCard label="Available Loan Limit" value={loanEligibility?.maxAmount || 0} color="#16a34a" bg="#dcfce7" highlight />
            <StatCard label="Active Loan Balance" value={activeOutstanding} color={activeOutstanding > 0 ? '#dc2626' : '#475569'} bg={activeOutstanding > 0 ? '#fee2e2' : '#f1f5f9'} />
            <StatCard label="Total Borrowed" value={totalBorrowed} color="#0369a1" bg="#e0f2fe" />
            <StatCard label="Total Repaid" value={totalPaid} color="#15803d" bg="#dcfce7" />
            <StatCard label="Total Outstanding" value={totalOutstanding} color="#b45309" bg="#fef9e7" />
          </div>

          {loans.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No loans yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr style={{ background: '#0f3460', color: '#fff' }}>
                  <th style={thL}>Type</th><th style={thL}>Amount</th><th style={thL}>Paid</th><th style={thL}>Outstanding</th><th style={thL}>Status</th><th style={thL}>Actions</th>
                </tr></thead>
                <tbody>
                  {loans.map(l => (
                    <tr key={l._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdL}>{String(l.type || '').replace('_', ' ')}</td>
                      <td style={tdL}>UGX {Number(l.amount || 0).toLocaleString()}</td>
                      <td style={{ ...tdL, color: '#15803d' }}>UGX {Number(l.paidAmount || 0).toLocaleString()}</td>
                      <td style={{ ...tdL, color: Number(l.outstandingBalance) > 0 ? '#dc2626' : '#15803d' }}>UGX {Number(l.outstandingBalance || 0).toLocaleString()}</td>
                      <td style={tdL}><span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: l.status === 'closed' ? '#dcfce7' : l.status === 'active' ? '#dbeafe' : '#fef9e7', color: l.status === 'closed' ? '#065f46' : l.status === 'active' ? '#1e40af' : '#b45309' }}>{String(l.status || '').toUpperCase()}</span></td>
                      <td style={tdL}>
                        <button onClick={() => setPdfModal({ title: `Schedule — ${l.type}`, url: `${API}/api/loans/repayment-schedule/${l._id}/pdf` })} style={btnMini('#2563eb')}>📄 Schedule</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'withdraw' && <div><h2>💸 Withdraw</h2><p>Contact the club office.</p></div>}

      {tab === 'club' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>🏛️ Club Statistics</h2>
            <button onClick={refreshClubStats} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🔄 Refresh</button>
          </div>
          {!clubStats ? <p style={{ color: '#64748b' }}>Loading…</p> : (
            <>
              <div style={{ background: 'linear-gradient(135deg, #0f3460 0%, #1e40af 100%)', color: '#fff', padding: '24px 28px', borderRadius: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', opacity: 0.75, textTransform: 'uppercase' }}>💠 Grand Total Available</div>
                <div style={{ fontSize: '38px', fontWeight: 800 }}>UGX {Number(clubStats.grandTotal || 0).toLocaleString()}</div>
              </div>
              <div style={gridCards}>
                <StatCard label="Club Capital" value={clubStats.totalClubCapital} color="#0369a1" bg="#e0f2fe" highlight />
                <StatCard label="Member Savings" value={clubStats.totalMemberSavings} color="#15803d" bg="#dcfce7" />
                <StatCard label="Total Shares" value={clubStats.totalShares} color="#7c3aed" bg="#f3e8ff" raw />
                <StatCard label="Members" value={clubStats.totalMembers} color="#475569" bg="#f1f5f9" raw />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'constitution' && (
        <div>
          <h2>📖 Club Constitution</h2>
          {!constitution ? <p>Loading…</p> : !constitution.hasConstitution ? (
            <p style={{ color: '#64748b' }}>Constitution has not been uploaded yet.</p>
          ) : constitution.paid ? (
            <div style={{ background: '#dcfce7', padding: '24px', borderRadius: '12px', border: '1px solid #86efac' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46', marginBottom: '8px' }}>✅ Access Granted</div>
              <a href={`${API}/api/member/constitution/download?memberId=${member.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 24px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}>📄 Download</a>
            </div>
          ) : (
            <div style={{ background: '#fef9e7', padding: '24px', borderRadius: '12px', border: '1px solid #fcd34d' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>🔒 Payment Required</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309' }}>UGX {(constitution.fee || 0).toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div>
          <h2>Club Leadership</h2>
          {leaders.map(l => (
            <div key={l._id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>{l.role}</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{l.name}</div>
              <div style={{ fontSize: '13px' }}>📞 {l.contact}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'password' && <ChangePasswordForm memberId={member.id} />}

      {pdfModal && <PdfOptionsModal title={pdfModal.title} baseUrl={pdfModal.url} onClose={() => setPdfModal(null)} />}

      {/* ==================== DIVIDEND ACTION MODAL ==================== */}
      {showDivAction && divSummary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '500px', maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {showDivAction === 'withdraw' && '💸 Withdraw to Cash'}
                {showDivAction === 'to_shares' && '📊 Buy More Shares'}
                {showDivAction === 'to_savings' && '💰 Add to Savings'}
                {showDivAction === 'donate' && '🏛️ Donate to Club'}
              </h2>
              <button onClick={() => { setShowDivAction(null); setDivMsg(''); }} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ background: '#cffafe', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#0e7490', fontWeight: 600 }}>Available Dividends</span>
              <span style={{ fontSize: '16px', color: '#0e7490', fontWeight: 800 }}>UGX {Number(divSummary.dividendBalance || 0).toLocaleString()}</span>
            </div>

            {divMsg && (
              <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '14px', background: divMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: divMsg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '13px' }}>{divMsg}</div>
            )}

            <form onSubmit={submitDivAction}>
              {showDivAction === 'to_shares' ? (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelSm}>Share Type</label>
                    <select value={divForm.shareType} onChange={e => setDivForm({ ...divForm, shareType: e.target.value })} style={inputStyle}>
                      <option value="golden">Golden — UGX {Number(sharePrices.golden?.price || 0).toLocaleString()}</option>
                      <option value="platinum">Platinum — UGX {Number(sharePrices.platinum?.price || 0).toLocaleString()}</option>
                      <option value="silver">Silver — UGX {Number(sharePrices.silver?.price || 0).toLocaleString()}</option>
                      <option value="bronze">Ordinary — UGX {Number(sharePrices.ordinary?.price || 0).toLocaleString()}</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelSm}>Quantity</label>
                    <input type="number" min="1" value={divForm.quantity} onChange={e => setDivForm({ ...divForm, quantity: e.target.value })} required style={inputStyle} />
                  </div>
                  <div style={{ background: '#0f3460', color: '#fff', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px' }}>Total Cost</span>
                    <span style={{ fontSize: '18px', fontWeight: 800 }}>
                      UGX {Number(
                        (parseInt(divForm.quantity) || 0) *
                        Number(sharePrices[{ golden: 'golden', platinum: 'platinum', silver: 'silver', bronze: 'ordinary' }[divForm.shareType]]?.price || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelSm}>Amount (UGX)</label>
                  <input type="number" min="1" max={divSummary.dividendBalance} value={divForm.amount} onChange={e => setDivForm({ ...divForm, amount: e.target.value })} required style={inputStyle} />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Max: UGX {Number(divSummary.dividendBalance).toLocaleString()}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowDivAction(null); setDivMsg(''); }} disabled={divBusy} style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={divBusy} style={{ padding: '10px 22px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: divBusy ? 'wait' : 'pointer', opacity: divBusy ? 0.6 : 1 }}>
                  {divBusy ? 'Processing…' : '✅ Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== APPLY SHARES MODAL ==================== */}
      {showShareModal && (() => {
        const settingsKey = { golden: 'golden', platinum: 'platinum', silver: 'silver', bronze: 'ordinary' }[shareForm.shareType];
        const typeSettings = sharePrices[settingsKey] || {};
        const unitPrice = Number(typeSettings.price || 0);
        const maxPerType = Number(typeSettings.maxShares || 15);
        const ownedOfType = Number(shares?.shares?.[shareForm.shareType]?.quantity || 0);
        const remainingOfType = Math.max(0, maxPerType - ownedOfType);
        const remainingTotal = Math.max(0, 15 - totalShareQty);
        const maxAllowed = Math.min(remainingOfType, remainingTotal);
        const qty = parseInt(shareForm.quantity) || 0;
        const amountDue = qty * unitPrice;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '520px', maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>📊 Apply for Shares</h2>
                <button onClick={() => { setShowShareModal(false); setShareMsg(''); }} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>

              {shareMsg && (
                <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '14px', background: shareMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: shareMsg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '13px' }}>{shareMsg}</div>
              )}

              <form onSubmit={submitShareApplication}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelSm}>Share Type</label>
                  <select value={shareForm.shareType} onChange={e => setShareForm({ ...shareForm, shareType: e.target.value })} style={inputStyle}>
                    <option value="golden">Golden — UGX {Number(sharePrices.golden?.price || 0).toLocaleString()}</option>
                    <option value="platinum">Platinum — UGX {Number(sharePrices.platinum?.price || 0).toLocaleString()}</option>
                    <option value="silver">Silver — UGX {Number(sharePrices.silver?.price || 0).toLocaleString()}</option>
                    <option value="bronze">Ordinary — UGX {Number(sharePrices.ordinary?.price || 0).toLocaleString()}</option>
                  </select>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelSm}>Quantity (max {maxAllowed})</label>
                  <input type="number" min="1" max={maxAllowed} value={shareForm.quantity} onChange={e => setShareForm({ ...shareForm, quantity: e.target.value })} required style={inputStyle} />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={labelSm}>Payment Method</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{ flex: 1, padding: '10px', border: `2px solid ${shareForm.paymentMethod === 'cash' ? '#2563eb' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: shareForm.paymentMethod === 'cash' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px' }}>
                      <input type="radio" checked={shareForm.paymentMethod === 'cash'} onChange={() => setShareForm({ ...shareForm, paymentMethod: 'cash' })} style={{ display: 'none' }} />
                      💵 Cash
                    </label>
                    <label style={{ flex: 1, padding: '10px', border: `2px solid ${shareForm.paymentMethod === 'savings' ? '#2563eb' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: shareForm.paymentMethod === 'savings' ? '#eff6ff' : '#fff', fontWeight: 600, fontSize: '13px' }}>
                      <input type="radio" checked={shareForm.paymentMethod === 'savings'} onChange={() => setShareForm({ ...shareForm, paymentMethod: 'savings' })} style={{ display: 'none' }} />
                      💰 From Savings
                    </label>
                  </div>
                </div>

                <div style={{ background: '#0f3460', color: '#fff', padding: '14px 18px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', opacity: 0.8 }}>Total Amount Due</span>
                  <span style={{ fontSize: '22px', fontWeight: 800 }}>UGX {amountDue.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setShowShareModal(false); setShareMsg(''); }} disabled={sharing} style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={sharing || qty <= 0 || qty > maxAllowed} style={{ padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: sharing ? 'wait' : 'pointer', opacity: (sharing || qty <= 0 || qty > maxAllowed) ? 0.5 : 1 }}>
                    {sharing ? 'Submitting…' : '✅ Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ==================== APPLY LOAN MODAL ==================== */}
      {showApplyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '26px', width: '520px', maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>🏦 Apply for Loan</h2>
              <button onClick={() => { setShowApplyModal(false); setApplyMessage(''); }} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: '#065f46', textTransform: 'uppercase', fontWeight: 600 }}>Your Loan Limit</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#065f46' }}>UGX {Number(loanEligibility?.maxAmount || 0).toLocaleString()}</div>
            </div>

            {applyMessage && (
              <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '14px', background: applyMessage.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: applyMessage.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: '13px' }}>{applyMessage}</div>
            )}

            <form onSubmit={submitLoanApplication}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelSm}>Loan Type</label>
                <select value={applyForm.type} onChange={e => setApplyForm({ ...applyForm, type: e.target.value })} style={inputStyle}>
                  <option value="emergency">Emergency</option>
                  <option value="school_fees">School Fees</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelSm}>Amount (UGX)</label>
                <input type="number" min="1" max={loanEligibility?.maxAmount || 0} value={applyForm.amount} onChange={e => setApplyForm({ ...applyForm, amount: e.target.value })} required style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelSm}>Duration (months)</label>
                  <input type="number" min="1" max="24" value={applyForm.duration} onChange={e => setApplyForm({ ...applyForm, duration: e.target.value })} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelSm}>Schedule</label>
                  <select value={applyForm.scheduleUnit} onChange={e => setApplyForm({ ...applyForm, scheduleUnit: e.target.value })} style={inputStyle}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowApplyModal(false); setApplyMessage(''); }} disabled={applying} style={{ padding: '10px 18px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={applying} style={{ padding: '10px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: applying ? 'wait' : 'pointer' }}>
                  {applying ? 'Submitting…' : '✅ Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordForm({ memberId }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setMsg('❌ Passwords do not match');
    try {
      const res = await apiFetch(`/api/member/me/${memberId}/change-password`, { method: 'PUT', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      const d = await res.json();
      if (res.ok) { setMsg('✅ Password changed'); setForm({ currentPassword: '', newPassword: '', confirm: '' }); }
      else setMsg('❌ ' + d.error);
    } catch (err) { setMsg('❌ Network error'); }
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: '400px' }}>
      {msg && <p style={{ padding: '10px', background: '#f1f5f9', borderRadius: '8px' }}>{msg}</p>}
      <Field label="Current Password"><input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} required style={input} /></Field>
      <Field label="New Password"><input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} required minLength="6" style={input} /></Field>
      <Field label="Confirm"><input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required style={input} /></Field>
      <button type="submit" style={btn('#2563eb')}>Change Password</button>
    </form>
  );
}

const Card = ({ title, value, color, bg, icon, raw }) => (
  <div style={{ background: bg, padding: '18px', borderRadius: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '14px', color, fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color }}>{raw ? (value ?? 0) : `UGX ${Number(value || 0).toLocaleString()}`}</div>
      </div>
      {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
    </div>
  </div>
);

const StatCard = ({ label, value, color, bg, raw, highlight }) => (
  <div style={{ background: bg, padding: '12px 14px', borderRadius: '10px', border: highlight ? `2px solid ${color}` : '1px solid transparent' }}>
    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '17px', fontWeight: '700', color, lineHeight: 1.2 }}>{raw ? (value ?? 0) : `UGX ${Number(value || 0).toLocaleString()}`}</div>
  </div>
);

const ActionBtn = ({ icon, label, onClick, disabled, color }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: '14px 12px', background: disabled ? '#e5e7eb' : color, color: disabled ? '#94a3b8' : '#fff',
    border: 'none', borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
  }}>
    <span style={{ fontSize: '22px' }}>{icon}</span>
    {label}
  </button>
);

const Info = ({ label, value }) => (
  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px' }}>
    <div style={{ fontSize: '12px', color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: '15px', fontWeight: '500' }}>{value || '—'}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>{label}</label>
    {children}
  </div>
);

const btn = (bg) => ({ padding: '10px 20px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' });
const btnMini = (bg) => ({ padding: '5px 10px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 });
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };
const labelSm = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' };
const thL = { padding: '10px', textAlign: 'left', fontWeight: 600, fontSize: '12px' };
const tdL = { padding: '10px' };
const gridCards = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' };