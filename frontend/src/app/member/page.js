'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PdfOptionsModal from '../../components/PdfOptionsModal';
import { apiFetch } from '../api-client';

export default function MemberDashboard() {
  const [scheduleModal, setScheduleModal] = useState(null);
  const router = useRouter();
  const [member, setMember] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savings, setSavings] = useState(null);
  const [shares, setShares] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [loans, setLoans] = useState([]);
  const [dividends, setDividends] = useState({ dividends: [], total: 0 });
  const [withdrawals, setWithdrawals] = useState({ withdrawals: [], totalPaid: 0 });
  const [certificates, setCertificates] = useState({ certificates: [], total: 0 });
  const [withdrawEligibility, setWithdrawEligibility] = useState(null);
  const [withdrawForm, setWithdrawForm] = useState({ source: 'savings', amount: '', notes: '' });
  const [withdrawMsg, setWithdrawMsg] = useState('');
  const [clubStats, setClubStats] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showApplyLoan, setShowApplyLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({
    type: 'emergency', amount: '', duration: 1, scheduleUnit: 'weekly', purpose: ''
  });

  useEffect(() => {
    const data = localStorage.getItem('member');
    if (!data) {
      router.replace('/member-login');
      return;
    }
    const m = JSON.parse(data);
    setMember(m);
    fetchAll(m.id);
  }, [router]);

  const fetchAll = async (id) => {
    try {
      const safe = (url) => apiFetch(url)
        .then(r => r.json())
        .catch((e) => { console.error('Fetch failed:', url, e); return null; });

      const [p, s, sh, l, d, w, cert, c, lead] = await Promise.all([
        safe(`/api/member/me/${id}`),
        safe(`/api/member/me/${id}/savings`),
        safe(`/api/member/me/${id}/shares`),
        safe(`/api/member/me/${id}/loans`),
        safe(`/api/member/me/${id}/dividends`),
        safe(`/api/withdrawals/member/${id}`),
        safe(`/api/share-certificates/member/${id}`),
        safe('/api/member/club-stats'),
        safe('/api/member/leaders')
      ]);

      setProfile(p);
      setSavings(s);
      setShares(sh);
      setLoans(Array.isArray(l) ? l : []);
      setDividends(d || { dividends: [], total: 0 });
      setWithdrawals(w || { withdrawals: [], totalPaid: 0 });
      setCertificates(cert || { certificates: [], total: 0 });
      setClubStats(c);
      setLeaders(Array.isArray(lead) ? lead : []);
    } catch (err) {
      console.error('fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (member && tab === 'withdraw' && savings) {
      apiFetch(`/api/withdrawals/eligibility/${member.id}?source=${withdrawForm.source}&amount=0`)
        .then(r => r.json())
        .then(d => setWithdrawEligibility(d))
        .catch(() => {});
    }
  }, [tab, withdrawForm.source, member, savings]);

  const handleApplyLoan = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/member/me/${member.id}/apply-loan`, {
        method: 'POST',
        body: JSON.stringify({
          type: loanForm.type,
          amount: parseFloat(loanForm.amount),
          duration: parseInt(loanForm.duration),
          scheduleUnit: loanForm.scheduleUnit,
          purpose: loanForm.purpose
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Loan application submitted!');
        setShowApplyLoan(false);
        setLoanForm({ type: 'emergency', amount: '', duration: 1, scheduleUnit: 'weekly', purpose: '' });
        fetchAll(member.id);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const viewSchedule = async (loanId) => {
    try {
      const res = await apiFetch(`/api/loans/${loanId}/schedule`);
      const data = await res.json();
      if (res.ok) setScheduleModal(data);
      else alert(data.error);
    } catch (err) { alert('Network error'); }
  };

  const logout = () => {
    localStorage.removeItem('member');
    localStorage.removeItem('token');
    router.replace('/member-login');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;
  if (!member) return null;

  const tabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'profile', label: '👤 Profile' },
    { id: 'savings', label: '💰 Savings' },
    { id: 'shares', label: '📊 Shares' },
    { id: 'certificates', label: '📜 Certificates' },
    { id: 'loans', label: '🏦 Loan History' },
    { id: 'dividends', label: '💵 Dividends' },
    { id: 'withdraw', label: '💸 Withdraw' },
    { id: 'club', label: '🏛️ Club Stats' },
    { id: 'contacts', label: '📞 Contacts' },
    { id: 'password', label: '🔒 Password' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {profile?.photo ? (
            <img src={profile.photo} alt="Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>👤</div>
          )}
          <div>
            <h2 style={{ margin: 0 }}>Welcome, {member.name}!</h2>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Member No: <strong>{member.memberNumber}</strong></div>
          </div>
        </div>
        <button onClick={logout} style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          Logout
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '3px solid #2563eb' : '3px solid transparent',
              color: tab === t.id ? '#1e293b' : '#64748b',
              fontWeight: tab === t.id ? '600' : '500',
              cursor: 'pointer', marginBottom: '-2px', fontSize: '14px'
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <h2>Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Card title="My Savings" value={savings?.totals?.total || 0} color="#15803d" bg="#dcfce7" icon="💰" />
            <Card title="My Shares" value={shares?.totalValue || 0} color="#7c3aed" bg="#f3e8ff" icon="📊" />
            <Card title="Active Loans" value={loans.filter(l => l.status === 'active').length} color="#b45309" bg="#fef9e7" icon="🏦" raw />
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
            <Info label="Occupation" value={profile.occupation || '—'} />
            <Info label="Address" value={profile.address} />
            <Info label="Date of Birth" value={new Date(profile.dateOfBirth).toLocaleDateString()} />
            <Info label="Subscribed On" value={new Date(profile.dateOfSubscription).toLocaleDateString()} />
          </div>
          <h3 style={{ marginTop: '24px' }}>Next of Kin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Info label="Name" value={profile.nextOfKin?.fullName} />
            <Info label="Relationship" value={profile.nextOfKin?.relationship} />
            <Info label="Contact" value={profile.nextOfKin?.contact} />
            <Info label="Email" value={profile.nextOfKin?.email || '—'} />
            <Info label="Address" value={profile.nextOfKin?.address} />
          </div>
        </div>
      )}

      {tab === 'savings' && savings && (
        <div>
          <h2>My Savings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
            <Card title="Monthly Savings" value={savings.totals.monthly} color="#0369a1" bg="#e0f2fe" />
            <Card title="Extra Savings" value={savings.totals.extra} color="#15803d" bg="#dcfce7" />
            <Card title="Total Savings" value={savings.totals.total} color="#7c3aed" bg="#f3e8ff" />
            <Card title="Locked (Loan)" value={savings.totals.locked || 0} color="#dc2626" bg="#fee2e2" />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => setPdfModal({ title: 'My Savings Statement', url: `https://pesaflow-api-jpll.onrender.com/api/savings/member-statement/${member.id}` })} style={btn('#3b82f6')}>📄 Download Statement PDF</button>
          </div>
          <h3>Transaction History</h3>
          <table style={table}>
            <thead><tr style={thead}><th style={th}>Date</th><th style={th}>Category</th><th style={th}>Amount</th></tr></thead>
            <tbody>
              {savings.savings.map(s => (
                <tr key={s._id} style={tr}>
                  <td style={td}>{new Date(s.date).toLocaleDateString()}</td>
                  <td style={td}>{s.category}</td>
                  <td style={td}>UGX {s.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'shares' && shares && (
        <div>
          <h2>My Shares</h2>
          <table style={table}>
            <thead><tr style={thead}><th style={th}>Type</th><th style={th}>Quantity</th><th style={th}>Price</th><th style={th}>Value</th></tr></thead>
            <tbody>
              {Object.entries(shares.shares).map(([type, s]) => (
                <tr key={type} style={tr}>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{type}</td>
                  <td style={td}>{s.quantity}</td>
                  <td style={td}>UGX {s.price.toLocaleString()}</td>
                  <td style={td}>UGX {s.value.toLocaleString()}</td>
                </tr>
              ))}
              <tr style={{ ...tr, fontWeight: '700', background: '#f1f5f9' }}>
                <td style={td}>Total</td>
                <td style={td}>{shares.totalQuantity}</td>
                <td style={td}>—</td>
                <td style={td}>UGX {shares.totalValue.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'certificates' && (
        <div>
          <h2>📜 My Share Certificates</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
            Certificates issued by the club certifying the shares you own. Download or print as proof of ownership.
          </p>

          {(certificates?.certificates || []).length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📜</div>
              <p style={{ color: '#64748b', margin: 0 }}>No certificates issued yet.</p>
              <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '12px' }}>Contact the club office if you need a certificate for your shares.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {certificates.certificates.map(c => (
                <div key={c._id} style={{ background: '#fff', border: '1px solid #c9a227', borderRadius: '12px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, #0f3460, #c9a227, #0f3460)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', letterSpacing: '1px' }}>CERTIFICATE NO.</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f3460' }}>{c.certificateNumber}</div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '600',
                      background: c.status === 'issued' ? '#dcfce7' : '#fee2e2',
                      color: c.status === 'issued' ? '#065f46' : '#991b1b'
                    }}>{c.status.toUpperCase()}</span>
                  </div>

                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#c9a227', marginBottom: '4px' }}>
                    {c.totalQuantity} Shares
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                    Total value: <strong style={{ color: '#0f3460' }}>UGX {Number(c.totalValue || 0).toLocaleString()}</strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
                    {['golden', 'platinum', 'silver', 'bronze'].map(t => {
                      const data = c.shares?.[t] || { qty: 0 };
                      return (
                        <div key={t} style={{ background: '#f8fafc', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>{t}</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{data.qty || 0}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                    Issued: {new Date(c.issueDate).toLocaleDateString('en-GB')}
                  </div>

                  {c.status === 'issued' ? (
                    <a
                      href={`https://pesaflow-api-jpll.onrender.com/api/share-certificates/${c._id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
                    >📄 Download Certificate PDF</a>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontWeight: '600', fontSize: '12px' }}>
                      Certificate Cancelled
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'loans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>My Loan History</h2>
            <button onClick={() => setShowApplyLoan(true)} style={btn('#2563eb')}>➕ Apply for Loan</button>
          </div>

          {loans.length === 0 ? <p>No loans yet.</p> : (
            <>
              {loans.filter(l => ['disbursed', 'active'].includes(l.status)).map(loan => {
                const paid = Number(loan.paidAmount || 0);
                const total = Number(loan.totalRepayable || 0);
                const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                return (
                  <div key={loan._id} style={{ background: 'linear-gradient(135deg, #0f3460, #1e40af)', color: '#fff', padding: '20px', borderRadius: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', opacity: 0.85 }}>💼 ACTIVE LOAN</div>
                      <div style={{ fontSize: '11px', opacity: 0.75, textTransform: 'capitalize' }}>{loan.type.replace('_', ' ')}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11px', opacity: 0.75 }}>Loan Amount</div>
                        <div style={{ fontSize: '18px', fontWeight: '700' }}>UGX {Number(loan.amount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', opacity: 0.75 }}>Outstanding</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fbbf24' }}>UGX {Number(loan.outstandingBalance || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', opacity: 0.75 }}>Paid So Far</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#86efac' }}>UGX {paid.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', opacity: 0.75 }}>Total Repayable</div>
                        <div style={{ fontSize: '18px', fontWeight: '700' }}>UGX {total.toLocaleString()}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.85, marginBottom: '4px' }}>
                        <span>Repayment Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#86efac', borderRadius: '4px', transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.85 }}>
                      Interest: {loan.interestRate}% | Installments: {loan.paidInstallments || 0}/{loan.totalInstallments || 0} paid
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => viewSchedule(loan._id)} style={{ background: '#fff', color: '#0f3460', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>📋 View Schedule</button>
                      <button onClick={() => setPdfModal({ title: `Loan Statement — ${loan.type}`, url: `https://pesaflow-api-jpll.onrender.com/api/loans/${loan._id}/statement-pdf` })} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>📄 Statement PDF</button>
                      <button onClick={() => setPdfModal({ title: `Repayment Schedule — ${loan.type}`, url: `https://pesaflow-api-jpll.onrender.com/api/loans/${loan._id}/schedule-pdf` })} style={{ background: '#0891b2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>📋 Schedule PDF</button>
                    </div>
                  </div>
                );
              })}

              {loans.filter(l => ['pending', 'approved'].includes(l.status)).length > 0 && (
                <>
                  <h3 style={{ marginTop: '24px' }}>Pending Applications</h3>
                  {loans.filter(l => ['pending', 'approved'].includes(l.status)).map(loan => (
                    <div key={loan._id} style={{ border: '1px solid #fcd34d', background: '#fef9e7', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ textTransform: 'capitalize' }}>{loan.type.replace('_', ' ')} — UGX {Number(loan.amount || 0).toLocaleString()}</strong>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', background: '#fcd34d', color: '#78350f', fontWeight: '600' }}>{loan.status}</span>
                      </div>
                      <div style={{ marginTop: '8px', color: '#78350f', fontSize: '13px' }}>
                        Interest: {loan.interestRate}% | Total repayable: UGX {Number(loan.totalRepayable || 0).toLocaleString()} | Applied: {new Date(loan.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <h3 style={{ marginTop: '24px' }}>Loan History</h3>
              {loans.filter(l => !['disbursed', 'active', 'pending', 'approved'].includes(l.status)).length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No closed loans yet.</p>
              ) : loans.filter(l => !['disbursed', 'active', 'pending', 'approved'].includes(l.status)).map(loan => (
                <div key={loan._id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '12px', background: '#fafbfc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ textTransform: 'capitalize' }}>{loan.type.replace('_', ' ')} — UGX {Number(loan.amount || 0).toLocaleString()}</strong>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      background: loan.status === 'closed' ? '#d1fae5' : loan.status === 'rejected' ? '#fee2e2' : '#f1f5f9',
                      color: loan.status === 'closed' ? '#065f46' : loan.status === 'rejected' ? '#991b1b' : '#475569'
                    }}>{loan.status}</span>
                  </div>
                  <div style={{ marginTop: '8px', color: '#64748b', fontSize: '13px' }}>
                    Interest: {loan.interestRate}% | Total repayable: UGX {Number(loan.totalRepayable || 0).toLocaleString()}
                    {loan.status === 'closed' && <span style={{ color: '#065f46', fontWeight: '600' }}> | ✅ Fully Repaid</span>}
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => viewSchedule(loan._id)} style={btnMini('#3b82f6')}>📋 View Schedule</button>
                    <button onClick={() => setPdfModal({ title: `Loan Statement — ${loan.type}`, url: `https://pesaflow-api-jpll.onrender.com/api/loans/${loan._id}/statement-pdf` })} style={btnMini('#7c3aed')}>📄 Statement</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'dividends' && (
        <div>
          <h2>My Dividends</h2>
          <div style={{ background: '#dcfce7', padding: '18px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#15803d' }}>Total Dividends Received</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#15803d' }}>UGX {(dividends?.total || 0).toLocaleString()}</div>
          </div>
          {(dividends?.dividends || []).length === 0 ? <p>No dividends yet.</p> : (
            <table style={table}>
              <thead><tr style={thead}><th style={th}>Date</th><th style={th}>Amount</th></tr></thead>
              <tbody>
                {dividends.dividends.map((d, i) => (
                  <tr key={i} style={tr}>
                    <td style={td}>{new Date(d.date).toLocaleDateString()}</td>
                    <td style={td}>UGX {(d.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'withdraw' && (
        <div>
          <h2>💸 Withdraw Funds</h2>

          <div style={{
            background: withdrawEligibility?.window?.ok ? '#dcfce7' : '#fef9e7',
            padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
            color: withdrawEligibility?.window?.ok ? '#065f46' : '#b45309', fontWeight: '600'
          }}>
            {!withdrawEligibility
              ? '⏳ Loading window status...'
              : withdrawEligibility.window.ok
                ? `✅ Withdrawal window is OPEN (${withdrawEligibility.window.period})`
                : '⏳ Withdrawal window is CLOSED — opens June 15–30 and December 15–30'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <Card title="Savings" value={savings?.totals?.total || 0} color="#15803d" bg="#dcfce7" />
            <Card title="Dividends Available" value={dividends?.total || 0} color="#7c3aed" bg="#f3e8ff" />
            <Card title="Max from Savings (20%)" value={Math.floor((savings?.totals?.total || 0) * 0.2)} color="#b45309" bg="#fef9e7" />
          </div>

          {withdrawMsg && (
            <div style={{
              padding: '12px', borderRadius: '8px', marginBottom: '16px',
              background: withdrawMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2',
              color: withdrawMsg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600'
            }}>{withdrawMsg}</div>
          )}

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Submit a Withdrawal Request</h3>

            <Field label="Withdraw From">
              <select
                value={withdrawForm.source}
                onChange={e => setWithdrawForm({ ...withdrawForm, source: e.target.value })}
                style={input}
              >
                <option value="savings">Savings (max 20%)</option>
                <option value="dividends">Dividends (no limit)</option>
              </select>
            </Field>

            <Field label="Amount (UGX)">
              <input
                type="number"
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                style={input}
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                type="text"
                value={withdrawForm.notes}
                onChange={e => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
                style={input}
              />
            </Field>

            <button
              type="button"
              onClick={async () => {
                setWithdrawMsg('');
                if (!withdrawForm.amount || Number(withdrawForm.amount) <= 0) {
                  return setWithdrawMsg('❌ Enter an amount');
                }
                try {
                  const res = await apiFetch('/api/withdrawals', {
                    method: 'POST',
                    body: JSON.stringify({
                      memberId: member.id,
                      source: withdrawForm.source,
                      amount: parseFloat(withdrawForm.amount),
                      notes: withdrawForm.notes,
                      requestedBy: 'member'
                    })
                  });
                  const d = await res.json();
                  if (res.ok) {
                    setWithdrawMsg('✅ ' + d.message);
                    setWithdrawForm({ source: 'savings', amount: '', notes: '' });
                    fetchAll(member.id);
                  } else {
                    setWithdrawMsg('❌ ' + d.error);
                  }
                } catch (err) { setWithdrawMsg('❌ Network error'); }
              }}
              style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >Submit Request</button>
          </div>

          <h3>My Withdrawals</h3>
          {(withdrawals?.withdrawals || []).length === 0 ? (
            <p style={{ color: '#6b7280' }}>No withdrawals yet.</p>
          ) : (
            <table style={table}>
              <thead>
                <tr style={thead}>
                  <th style={th}>Date</th>
                  <th style={th}>Source</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.withdrawals.map(w => (
                  <tr key={w._id} style={tr}>
                    <td style={td}>{new Date(w.requestedDate).toLocaleDateString()}</td>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{w.source}</td>
                    <td style={td}>UGX {w.amount.toLocaleString()}</td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: w.status === 'paid' ? '#dcfce7' : w.status === 'rejected' ? '#fee2e2' : w.status === 'approved' ? '#e0f2fe' : '#fef9e7',
                        color: w.status === 'paid' ? '#065f46' : w.status === 'rejected' ? '#991b1b' : w.status === 'approved' ? '#0369a1' : '#b45309'
                      }}>{w.status}</span>
                    </td>
                    <td style={td}>{w.paymentMethod || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'club' && clubStats && (
        <div>
          <h2>Club Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <Card title="Total Club Capital" value={clubStats.totalClubCapital} color="#0369a1" bg="#e0f2fe" />
            <Card title="Total Member Savings" value={clubStats.totalMemberSavings} color="#15803d" bg="#dcfce7" />
            <Card title="Total Shares" value={clubStats.totalShares} color="#7c3aed" bg="#f3e8ff" raw />
            <Card title="Total Miscellaneous" value={clubStats.totalMisc} color="#b45309" bg="#fef9e7" />
            <Card title="Total Penalties" value={clubStats.totalPenalty} color="#dc2626" bg="#fee2e2" />
            <Card title="Total Donations" value={clubStats.totalDonation} color="#0891b2" bg="#cffafe" />
          </div>

          <h3 style={{ marginTop: '24px' }}>Business Profits</h3>
          <table style={table}>
            <thead><tr style={thead}><th style={th}>Business</th><th style={th}>Current Balance</th><th style={th}>Profit Extracted</th></tr></thead>
            <tbody>
              {(clubStats?.businessStats || []).map((b, i) => (
                <tr key={i} style={tr}>
                  <td style={td}>{b.name}</td>
                  <td style={td}>UGX {(b.currentBalance || 0).toLocaleString()}</td>
                  <td style={td}>UGX {(b.totalProfit || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'contacts' && (
        <div>
          <h2>Club Leadership</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {leaders.length === 0 ? <p>No leaders set up yet.</p> : leaders.map(l => (
              <div key={l._id} style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>{l.role}</div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginTop: '4px' }}>{l.name}</div>
                <div style={{ color: '#334155', fontSize: '14px', marginTop: '8px' }}>📞 {l.contact}</div>
                {l.email && <div style={{ color: '#334155', fontSize: '14px' }}>✉️ {l.email}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'password' && <ChangePasswordForm memberId={member.id} />}

      {showApplyLoan && (
        <div style={modalBg}>
          <div style={modalBox}>
            <h2 style={{ marginTop: 0 }}>Apply for Loan</h2>
            <form onSubmit={handleApplyLoan}>
              <Field label="Loan Type">
                <select value={loanForm.type} onChange={e => setLoanForm({ ...loanForm, type: e.target.value })} style={input}>
                  <option value="emergency">Emergency (1 month)</option>
                  <option value="school_fees">School Fees (1-3 months)</option>
                  <option value="business">Business (1-6 months)</option>
                </select>
              </Field>
              <Field label="Amount (UGX)"><input type="number" value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })} required style={input} /></Field>
              <Field label="Duration (months)"><input type="number" value={loanForm.duration} onChange={e => setLoanForm({ ...loanForm, duration: e.target.value })} required style={input} /></Field>
              <Field label="Repayment Schedule">
                <select value={loanForm.scheduleUnit} onChange={e => setLoanForm({ ...loanForm, scheduleUnit: e.target.value })} style={input}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Purpose"><input type="text" value={loanForm.purpose} onChange={e => setLoanForm({ ...loanForm, purpose: e.target.value })} style={input} /></Field>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" style={btn('#2563eb')}>Submit</button>
                <button type="button" onClick={() => setShowApplyLoan(false)} style={btn('#6b7280')}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div style={modalBg}>
          <div style={{ ...modalBox, width: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Repayment Schedule</h2>
              <button onClick={() => setScheduleModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            {(() => {
              const loan = scheduleModal.loan || {};
              const reps = scheduleModal.repayments || [];
              const principal = Number(loan.amount) || 0;
              const total = Number(loan.totalRepayable) || 0;
              const totalInstallments = reps.length || 1;
              const principalPerInst = principal / totalInstallments;
              let runningBalance = total;

              return (
                <>
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#64748b' }}>
                    <strong>Type:</strong> {(loan.type || '').replace('_', ' ')} |{' '}
                    <strong>Amount:</strong> UGX {principal.toLocaleString()} |{' '}
                    <strong>Rate:</strong> {loan.interestRate || 0}% |{' '}
                    <strong>Total:</strong> UGX {total.toLocaleString()}
                  </div>

                  {reps.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>No schedule items.</p>
                  ) : (
                    <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead style={{ position: 'sticky', top: 0 }}>
                          <tr style={{ background: '#0f3460', color: '#fff' }}>
                            <th style={th}>#</th>
                            <th style={th}>Due Date</th>
                            <th style={th}>Payment</th>
                            <th style={th}>Interest</th>
                            <th style={th}>Principal</th>
                            <th style={th}>Balance</th>
                            <th style={th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reps.map((r, i) => {
                            const payment = Number(r.amountDue) || 0;
                            const interest = Math.max(0, payment - principalPerInst);
                            runningBalance = Math.max(0, runningBalance - payment);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                <td style={td}>{r.installmentNumber}</td>
                                <td style={td}>{new Date(r.dueDate).toLocaleDateString()}</td>
                                <td style={td}>UGX {payment.toLocaleString()}</td>
                                <td style={td}>UGX {Math.round(interest).toLocaleString()}</td>
                                <td style={td}>UGX {Math.round(principalPerInst).toLocaleString()}</td>
                                <td style={{ ...td, fontWeight: '600', color: runningBalance === 0 ? '#15803d' : '#b45309' }}>
                                  UGX {Math.round(runningBalance).toLocaleString()}
                                </td>
                                <td style={td}>
                                  <span style={{
                                    padding: '3px 8px', borderRadius: '12px', fontSize: '11px',
                                    background: r.status === 'paid' ? '#d1fae5' : '#fef9e7',
                                    color: r.status === 'paid' ? '#065f46' : '#b45309'
                                  }}>{r.status || 'pending'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button onClick={() => setScheduleModal(null)} style={btn('#6b7280')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {pdfModal && (
        <PdfOptionsModal
          title={pdfModal.title}
          baseUrl={pdfModal.url}
          onClose={() => setPdfModal(null)}
        />
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
      const res = await apiFetch(`/api/member/me/${memberId}/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ Password changed successfully');
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
      } else setMsg('❌ ' + d.error);
    } catch (err) { setMsg('❌ Network error'); }
  };

  return (
    <div>
      <h2>Change Password</h2>
      {msg && <p style={{ padding: '10px', background: '#f1f5f9', borderRadius: '8px' }}>{msg}</p>}
      <form onSubmit={submit} style={{ maxWidth: '400px' }}>
        <Field label="Current Password"><input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} required style={input} /></Field>
        <Field label="New Password"><input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} required minLength="6" style={input} /></Field>
        <Field label="Confirm New Password"><input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required style={input} /></Field>
        <button type="submit" style={btn('#2563eb')}>Change Password</button>
      </form>
    </div>
  );
}

const Card = ({ title, value, color, bg, icon, raw }) => (
  <div style={{ background: bg, padding: '18px', borderRadius: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '14px', color, fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color }}>
          {raw ? (value ?? 0) : `UGX ${Number(value || 0).toLocaleString()}`}
        </div>
      </div>
      {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
    </div>
  </div>
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
const btnMini = (bg) => ({ padding: '5px 12px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', marginRight: '6px', cursor: 'pointer', fontSize: '12px' });
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '10px' };
const thead = { background: '#f8fafc', borderBottom: '2px solid #e5e7eb' };
const th = { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const td = { padding: '10px' };
const tr = { borderBottom: '1px solid #f1f5f9' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', padding: '30px', borderRadius: '16px', width: '480px', maxHeight: '90vh', overflow: 'auto' };