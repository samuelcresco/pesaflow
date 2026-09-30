'use client';

import { useEffect, useState } from 'react';
import PdfOptionsModal from '../../components/PdfOptionsModal';
import MemberSearch, { filterBySearch } from '../../components/MemberSearch';
import { apiFetch, API } from '../api-client';

const PURPOSE_OPTIONS = [
  'School Fees', 'Business', 'Fuel', 'Child Sick',
  'Hospital', 'Mechanical', 'Topup'
];

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [fundBalance, setFundBalance] = useState(0);
  const [clubCapital, setClubCapital] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showApply, setShowApply] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [error, setError] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [scheduleModal, setScheduleModal] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [interestEarned, setInterestEarned] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [interestBalance, setInterestBalance] = useState(0);
  const [nextMilestone, setNextMilestone] = useState(0);
  const [untilNextMilestone, setUntilNextMilestone] = useState(0);
  const [extractInterestAmount, setExtractInterestAmount] = useState('');
  const [showExtractToLoan, setShowExtractToLoan] = useState(false);
  const [showExtractToClub, setShowExtractToClub] = useState(false);
  const [showExternal, setShowExternal] = useState(false);
  const [externalForm, setExternalForm] = useState({ funderName: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [reverseModal, setReverseModal] = useState(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    memberId: '', type: 'emergency', amount: '', duration: '',
    scheduleUnit: 'weekly', purpose: 'School Fees'
  });

  useEffect(() => {
    fetchAll();
    fetchFund();
    fetchInterest();
    fetchPending();
    fetchOverdue();
  }, []);

  const fetchAll = async () => {
    try {
      const [l, m, s] = await Promise.all([
        apiFetch('/api/loans').then(r => r.json()),
        apiFetch('/api/members').then(r => r.json()),
        apiFetch('/api/savings/summary').then(r => r.json())
      ]);
      setLoans(Array.isArray(l) ? l : []);
      setMembers(Array.isArray(m) ? m : []);
      setClubCapital(s?.clubCapital || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchFund = async () => {
    try {
      const res = await apiFetch('/api/loans/fund-status');
      const d = await res.json();
      setFundBalance(d.balance || 0);
      setInterestBalance(d.interestBalance || 0);
      setNextMilestone(d.nextMilestone || 1000000);
      setUntilNextMilestone(d.untilNextMilestone || 0);
    } catch (err) { console.error(err); }
  };

  const fetchInterest = async () => {
    try {
      const res = await apiFetch('/api/loans/interest-earned');
      const d = await res.json();
      setInterestEarned(d.totalInterestEarned || 0);
    } catch (err) { console.error(err); }
  };

  const fetchPending = async () => {
    try {
      const res = await apiFetch('/api/loans/pending-count');
      const d = await res.json();
      setPendingCount(d.pending || 0);
    } catch (err) { console.error(err); }
  };

  const fetchOverdue = async () => {
    try {
      const res = await apiFetch('/api/loans/overdue-count');
      const d = await res.json();
      setOverdueCount(d.overdue || 0);
    } catch (err) { console.error(err); }
  };

  const handleMemberChange = async (memberId) => {
    setForm(prev => ({ ...prev, memberId }));
    if (!memberId) return setEligibility(null);
    try {
      const res = await apiFetch(`/api/loans/eligibility/${memberId}/${form.type}`);
      setEligibility(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleTypeChange = async (type) => {
    setForm(prev => ({ ...prev, type }));
    if (form.memberId) {
      const res = await apiFetch(`/api/loans/eligibility/${form.memberId}/${type}`);
      setEligibility(await res.json());
    }
  };

  const submitLoan = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch('/api/loans/apply', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId, type: form.type,
          amount: parseFloat(form.amount), duration: parseInt(form.duration),
          scheduleUnit: form.scheduleUnit, purpose: form.purpose
        })
      });
      const d = await res.json();
      if (res.ok) {
        alert('✅ Loan submitted');
        setShowApply(false);
        setForm({ memberId: '', type: 'emergency', amount: '', duration: '', scheduleUnit: 'weekly', purpose: 'School Fees' });
        setEligibility(null);
        fetchAll(); fetchFund();
      } else setError(d.error);
    } catch (err) { setError('Network error'); }
  };

  const updateStatus = async (id, status) => {
    const res = await apiFetch(`/api/loans/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (res.ok) { fetchAll(); fetchFund(); }
  };

  const handleFund = async () => {
    const res = await apiFetch('/api/loans/fund-loan-card', {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(fundAmount) })
    });
    const d = await res.json();
    if (res.ok) {
      alert(d.message || '✅ Funded');
      setShowFund(false); setFundAmount('');
      fetchAll(); fetchFund();
    } else alert(d.error);
  };

  const handleExternalFund = async () => {
    try {
      const res = await apiFetch('/api/loans/fund-from-external', {
        method: 'POST',
        body: JSON.stringify({
          funderName: externalForm.funderName,
          amount: parseFloat(externalForm.amount),
          description: externalForm.description,
          date: externalForm.date
        })
      });
      const d = await res.json();
      if (res.ok) {
        alert(d.message || '✅ Funded');
        setShowExternal(false);
        setExternalForm({ funderName: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
        fetchAll(); fetchFund();
      } else {
        alert(d.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const openSchedule = async (loanId) => {
    try {
      const loan = loans.find(l => l._id === loanId);
      const res = await apiFetch(`/api/loans/${loanId}/schedule`);
      const data = await res.json();

      let repayments = [];
      let loanData = loan || {};

      if (Array.isArray(data)) {
        repayments = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.repayments)) repayments = data.repayments;
        else if (Array.isArray(data.schedule)) repayments = data.schedule;
        else if (Array.isArray(data.installments)) repayments = data.installments;
        if (data.loan) loanData = data.loan;
      }

      setScheduleModal({ loanId, loan: loanData, repayments });
    } catch (err) {
      console.error('Schedule error:', err);
      const loan = loans.find(l => l._id === loanId);
      setScheduleModal({ loanId, loan: loan || {}, repayments: [] });
    }
  };

  const markPaid = async (loanId, installmentNumber) => {
    if (!confirm('Mark this installment as paid?')) return;
    try {
      const res = await apiFetch(`/api/loans/mark-paid/${loanId}/${installmentNumber}`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Paid!\nPrincipal added to Loan Fund: UGX ${Math.round(data.principalAdded || 0).toLocaleString()}\nInterest added to Interest Fund: UGX ${Math.round(data.interestAdded || 0).toLocaleString()}\nRemaining Outstanding: UGX ${Math.round(data.remainingOutstanding || 0).toLocaleString()}`);
        const freshRes = await apiFetch(`/api/loans/${loanId}/schedule`);
        const freshData = await freshRes.json();
        let freshReps = [];
        if (Array.isArray(freshData)) freshReps = freshData;
        else if (freshData && Array.isArray(freshData.repayments)) freshReps = freshData.repayments;
        else if (freshData && Array.isArray(freshData.schedule)) freshReps = freshData.schedule;
        setScheduleModal(prev => ({ ...prev, repayments: freshReps }));
        fetchAll();
        fetchFund();
        fetchInterest();
        fetchOverdue();
      } else {
        alert('❌ ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('❌ Network error');
    }
  };

  const applyPenalty = async (loanId, installmentNumber) => {
    if (!confirm('Apply late payment penalty to this installment?')) return;
    try {
      const res = await apiFetch(`/api/loans/apply-late-penalty/${loanId}/${installmentNumber}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Penalty of UGX ${(data.penaltyAmount || 0).toLocaleString()} applied`);
        fetchAll(); fetchOverdue(); fetchInterest();
      } else {
        alert('❌ ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('❌ Network error');
    }
  };

  const deleteLoan = async (loan) => {
    if (!confirm(`Delete this loan (${loan.type} — UGX ${Number(loan.amount).toLocaleString()})?\n\nAll repayments will also be deleted, and account balances reversed.`)) return;
    try {
      const res = await apiFetch(`/api/loans/${loan._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert('✅ ' + (data.message || 'Loan deleted'));
        fetchAll(); fetchFund();
      } else {
        alert('❌ ' + (data.error || 'Failed'));
      }
    } catch (err) {
      alert('❌ Network error');
    }
  };

  const getLoanBalance = (loan) => {
    const paidAmount = (loan.repayments || [])
      .filter(r => r.status === 'paid')
      .reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);
    return Math.max(0, Number(loan.totalRepayable || 0) - paidAmount);
  };

  const tabFiltered = activeTab === 'all' ? loans : loans.filter(l => l.status === activeTab);
  const filtered = filterBySearch(tabFiltered, search, [
    'memberId.firstName',
    'memberId.surname',
    'memberId.memberNumber',
    'type',
    'status',
    'purpose'
  ]);

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;
  return (
    <div style={{ padding: '16px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '12px' }}>📋 Loan Management</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f3460, #1e40af)', padding: '12px 16px', borderRadius: '10px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>💼 LOAN FUND BALANCE</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginTop: '2px' }}>UGX {fundBalance.toLocaleString()}</div>
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>For lending</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)', padding: '12px 16px', borderRadius: '10px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>💵 INTEREST FUND BALANCE</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginTop: '2px' }}>UGX {interestBalance.toLocaleString()}</div>
          </div>
          <div style={{ fontSize: '10px', opacity: 0.9, textAlign: 'right' }}>
            <div>Next milestone:</div>
            <div style={{ fontWeight: '700' }}>{untilNextMilestone.toLocaleString()} away</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <Card title="Total Pending" value={loans.filter(l => l.status === 'pending').length} color="#b45309" bg="#fef9e7" icon="⏳" />
        <Card title="Active Loans" value={loans.filter(l => l.status === 'active').length} color="#15803d" bg="#dcfce7" icon="✅" />
        <Card title="Overdue" value={overdueCount} color="#dc2626" bg="#fee2e2" icon="⚠️" />
        <Card title="Outstanding" value={loans.filter(l => ['active', 'disbursed'].includes(l.status)).reduce((s, l) => s + Number(l.outstandingBalance || l.totalRepayable || 0), 0)} color="#dc2626" bg="#fee2e2" icon="📌" isMoney />
        <Card title="Total to be Repaid" value={loans.reduce((s, l) => s + Number(l.totalRepayable || 0), 0)} color="#7c3aed" bg="#f3e8ff" icon="💵" isMoney />
        <Card title="Interest Earned" value={interestEarned} color="#0891b2" bg="#cffafe" icon="📈" isMoney />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <Btn onClick={() => setShowApply(true)} color="#2563eb">➕ New Loan Application</Btn>
        <Btn onClick={() => setShowFund(true)} color="#f59e0b">💰 Fund from Club Capital</Btn>
        <Btn onClick={() => setShowExternal(true)} color="#0891b2">💵 Fund from External Funder</Btn>
        <Btn onClick={() => setPdfModal({ title: 'General Loan Statement', url: 'http://localhost:5000/api/loans/general-loan-statement/pdf' })} color="#7c3aed">📄 General Loan Statement</Btn>
        <Btn onClick={() => setShowExtractToLoan(true)} color="#16a34a">💵 Extract Interest to Loan Fund</Btn>
        <Btn onClick={() => setShowExtractToClub(true)} color="#dc2626">🏛️ Extract Interest to Club Capital</Btn>
      </div>

      <div style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ background: '#0f3460', color: '#fff', padding: '8px 12px', fontWeight: '600', fontSize: '13px' }}>
          💼 Fund History
        </div>
        <FundHistory />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <MemberSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by member name, number, loan type, status, or purpose..."
        />
        {search && (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Showing {filtered.length} of {tabFiltered.length} loans
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '2px', borderBottom: '2px solid #e5e7eb', marginBottom: '12px', flexWrap: 'wrap' }}>
        {['all','pending','approved','disbursed','active','closed','rejected','writeOff'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '6px 12px', background: 'transparent', border: 'none',
            borderBottom: activeTab === t ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === t ? '#1e293b' : '#64748b', fontSize: '12px',
            fontWeight: activeTab === t ? '600' : '500', cursor: 'pointer', marginBottom: '-2px'
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>
          {search ? `No loans match "${search}".` : 'No loans found.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: '#0f3460', color: '#fff' }}>
              <th style={th}>Member</th><th style={th}>Type</th><th style={th}>Amount</th>
              <th style={th}>Rate</th><th style={th}>Total</th><th style={th}>Balance</th><th style={th}>Status</th><th style={th}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((loan, i) => (
                <tr key={loan._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{loan.memberId?.firstName || '?'} {loan.memberId?.surname || ''}</td>
                  <td style={td}>{loan.type}</td>
                  <td style={td}>UGX {Number(loan.amount || 0).toLocaleString()}</td>
                  <td style={td}>{loan.interestRate}%</td>
                  <td style={td}>UGX {Number(loan.totalRepayable || 0).toLocaleString()}</td>
                  <td style={{ ...td, fontWeight: '600', color: getLoanBalance(loan) > 0 ? '#dc2626' : '#15803d' }}>
                    UGX {getLoanBalance(loan).toLocaleString()}
                  </td>
                  <td style={td}><strong>{loan.status}</strong></td>
                  <td style={td}>
                    {loan.status === 'pending' && (<>
                      <button onClick={() => updateStatus(loan._id, 'approved')} style={mini('#22c55e')}>Approve</button>
                      <button onClick={() => updateStatus(loan._id, 'rejected')} style={mini('#ef4444')}>Reject</button>
                    </>)}
                    {loan.status === 'approved' && <button onClick={() => updateStatus(loan._id, 'disbursed')} style={mini('#f59e0b')}>Disburse</button>}
                    {loan.status === 'disbursed' && <button onClick={() => updateStatus(loan._id, 'active')} style={mini('#8b5cf6')}>Set Active</button>}
                    {loan.status === 'active' && <button onClick={() => updateStatus(loan._id, 'closed')} style={mini('#6b7280')}>Close</button>}
                    {loan.status !== 'closed' && <button onClick={() => setReverseModal(loan)} style={mini('#f97316')}>↩️ Reverse</button>}
                    <button onClick={() => deleteLoan(loan)} style={mini('#dc2626')}>🗑 Delete</button>
                    <button onClick={() => openSchedule(loan._id)} style={mini('#0ea5e9')}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showApply && (
        <Modal onClose={() => setShowApply(false)} title="Apply for a Loan">
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <form onSubmit={submitLoan}>
            <Field label="Member">
              <select value={form.memberId} onChange={e => handleMemberChange(e.target.value)} required style={input}>
                <option value="">Select Member</option>
                {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>)}
              </select>
            </Field>

            {eligibility && (
              <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                <strong>Member Savings:</strong> UGX {eligibility.memberSavings?.toLocaleString()}<br />
                <strong>70% Limit:</strong> UGX {eligibility.maxAmount?.toLocaleString()}<br />
                {eligibility.hasActiveLoan && <span style={{ color: '#dc2626' }}>⚠️ Member has an active loan</span>}
              </div>
            )}

            <Field label="Loan Type">
              <select value={form.type} onChange={e => handleTypeChange(e.target.value)} required style={input}>
                <option value="emergency">Emergency (1 month)</option>
                <option value="school_fees">School Fees (1-3 months)</option>
                <option value="business">Business (1-6 months)</option>
              </select>
            </Field>

            <Field label={`Amount (UGX)${eligibility ? ` — Max: ${eligibility.maxAmount?.toLocaleString()}` : ''}`}>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder={eligibility ? eligibility.maxAmount?.toString() : 'Enter amount'}
                max={eligibility ? eligibility.maxAmount : undefined}
                required style={input} />
            </Field>

            <Field label="Duration (months)">
              <input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} required style={input} />
            </Field>

            <Field label="Repayment Schedule">
              <select value={form.scheduleUnit} onChange={e => setForm({ ...form, scheduleUnit: e.target.value })} style={input}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>

            <Field label="Purpose">
              <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} style={input}>
                {PURPOSE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={btn('#2563eb')}>Submit</button>
              <button type="button" onClick={() => setShowApply(false)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showFund && (
        <AmountModal
          title="Fund Loan Card"
          onClose={() => setShowFund(false)}
          value={fundAmount}
          setValue={setFundAmount}
          onSubmit={handleFund}
          color="#f59e0b"
          placeholder={clubCapital}
          hint={`Available Club Capital: UGX ${clubCapital.toLocaleString()}`}
        />
      )}

      {showExternal && (
        <Modal onClose={() => setShowExternal(false)} title="Fund from External Funder">
          <Field label="Funder Name">
            <input type="text" value={externalForm.funderName} onChange={e => setExternalForm({ ...externalForm, funderName: e.target.value })} placeholder="e.g., John Doe" style={input} />
          </Field>
          <Field label="Amount (UGX)">
            <input type="number" value={externalForm.amount} onChange={e => setExternalForm({ ...externalForm, amount: e.target.value })} style={input} />
          </Field>
          <Field label="Date">
            <input type="date" value={externalForm.date} onChange={e => setExternalForm({ ...externalForm, date: e.target.value })} style={input} />
          </Field>
          <Field label="Description (optional)">
            <input type="text" value={externalForm.description} onChange={e => setExternalForm({ ...externalForm, description: e.target.value })} style={input} />
          </Field>
          <button onClick={handleExternalFund} style={btn('#0891b2')}>Confirm</button>
        </Modal>
      )}

      {showExtractToLoan && (
        <Modal onClose={() => setShowExtractToLoan(false)} title="Extract Interest to Loan Fund">
          <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
            <strong>Available Interest:</strong> UGX {interestBalance.toLocaleString()}
          </div>
          <Field label="Amount (UGX)">
            <input type="number" value={extractInterestAmount} onChange={e => setExtractInterestAmount(e.target.value)} style={input} />
          </Field>
          <button onClick={async () => {
            if (!extractInterestAmount || Number(extractInterestAmount) <= 0) return alert('Enter amount');
            try {
              const res = await apiFetch('/api/loans/extract-to-loan-fund', {
                method: 'POST',
                body: JSON.stringify({ amount: parseFloat(extractInterestAmount) })
              });
              const d = await res.json();
              if (res.ok) {
                alert(d.message || '✅ Moved');
                setShowExtractToLoan(false);
                setExtractInterestAmount('');
                fetchFund();
              } else alert(d.error);
            } catch (err) { alert('Network error'); }
          }} style={btn('#16a34a')}>Confirm</button>
        </Modal>
      )}

      {showExtractToClub && (
        <Modal onClose={() => setShowExtractToClub(false)} title="Extract Interest to Club Capital">
          <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
            <strong>Available Interest:</strong> UGX {interestBalance.toLocaleString()}
          </div>
          <Field label="Amount (UGX)">
            <input type="number" value={extractInterestAmount} onChange={e => setExtractInterestAmount(e.target.value)} style={input} />
          </Field>
          <button onClick={async () => {
            if (!extractInterestAmount || Number(extractInterestAmount) <= 0) return alert('Enter amount');
            try {
              const res = await apiFetch('/api/loans/extract-to-club-capital', {
                method: 'POST',
                body: JSON.stringify({ amount: parseFloat(extractInterestAmount) })
              });
              const d = await res.json();
              if (res.ok) {
                alert(d.message || '✅ Moved');
                setShowExtractToClub(false);
                setExtractInterestAmount('');
                fetchFund();
              } else alert(d.error);
            } catch (err) { alert('Network error'); }
          }} style={btn('#dc2626')}>Confirm</button>
        </Modal>
      )}

      {reverseModal && (
        <Modal onClose={() => setReverseModal(null)} title="↩️ Reverse Loan">
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            Current status: <strong style={{ textTransform: 'capitalize' }}>{reverseModal.status}</strong>
          </p>
          <p style={{ fontSize: '13px', marginBottom: '12px' }}>
            Pick the status to move back to. Money movements and repayments will be reversed accordingly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {['pending', 'approved', 'disbursed', 'active'].filter(s => {
              const order = { pending: 0, approved: 1, disbursed: 2, active: 3, closed: 4 };
              return order[s] < order[reverseModal.status];
            }).map(s => (
              <button key={s} onClick={async () => {
                if (!confirm(`Reverse this loan back to "${s}"?`)) return;
                try {
                  const res = await apiFetch(`/api/loans/${reverseModal._id}/reverse`, {
                    method: 'PUT',
                    body: JSON.stringify({ targetStatus: s })
                  });
                  const d = await res.json();
                  if (res.ok) {
                    alert('✅ ' + (d.message || 'Reversed'));
                    setReverseModal(null);
                    fetchAll(); fetchFund();
                  } else alert('❌ ' + (d.error || 'Failed'));
                } catch (err) { alert('❌ Network error'); }
              }} style={{
                padding: '10px 16px',
                background: s === 'pending' ? '#f59e0b' : s === 'approved' ? '#3b82f6' : s === 'disbursed' ? '#22c55e' : '#8b5cf6',
                color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize'
              }}>
                → Back to {s}
              </button>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={() => setReverseModal(null)} style={btn('#6b7280')}>Cancel</button>
          </div>
        </Modal>
      )}

      {scheduleModal && (
        <Modal onClose={() => setScheduleModal(null)} title={`Repayment Schedule — ${scheduleModal.loan?.memberId?.firstName || scheduleModal.loan?.memberName || ''}`}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#64748b' }}>
            <strong>Type:</strong> {scheduleModal.loan?.type} |
            <strong> Amount:</strong> UGX {(scheduleModal.loan?.amount || 0).toLocaleString()} |
            <strong> Rate:</strong> {scheduleModal.loan?.interestRate}% |
            <strong> Total:</strong> UGX {(scheduleModal.loan?.totalRepayable || 0).toLocaleString()}
          </div>

          {(() => {
            const reps = Array.isArray(scheduleModal.repayments) ? scheduleModal.repayments : [];
            const totalPaid = reps.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);
            const totalRepayable = Number(scheduleModal.loan?.totalRepayable) || 0;
            const outstanding = Math.max(0, totalRepayable - totalPaid);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#0369a1' }}>Total Repayable</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>UGX {totalRepayable.toLocaleString()}</div>
                </div>
                <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#15803d' }}>Paid So Far</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>UGX {totalPaid.toLocaleString()}</div>
                </div>
                <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#dc2626' }}>Outstanding</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626' }}>UGX {outstanding.toLocaleString()}</div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              onClick={() => {
                const loanId = scheduleModal.loanId;
                const memberName = scheduleModal.loan?.memberId?.firstName || '';
                setScheduleModal(null);
                setPdfModal({
                  title: `Repayment Schedule — ${memberName}`,
                  url: `http://localhost:5000/api/loans/repayment-schedule/${loanId}/pdf`
                });
              }}
              style={btn('#7c3aed')}
            >📄 Download PDF</button>
          </div>

          {!Array.isArray(scheduleModal.repayments) || scheduleModal.repayments.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No schedule yet.</p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f3460', color: '#fff', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Due Date</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Payment</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Interest</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Principal</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Balance</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let runningBalance = Number(scheduleModal.loan?.totalRepayable) || 0;
                    const reps = scheduleModal.repayments;
                    const totalInstallments = reps.length || 1;
                    const principalTotal = Number(scheduleModal.loan?.amount) || 0;
                    return reps.map((r, i) => {
                      const payment = Number(r.amountDue || r.amount || r.payment || r.installmentAmount || 0);
                      const principalPart = principalTotal / totalInstallments;
                      const interestPart = Math.max(0, payment - principalPart);
                      runningBalance = Math.max(0, runningBalance - payment);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={td}>{r.installmentNumber}</td>
                          <td style={td}>{new Date(r.dueDate).toLocaleDateString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{payment.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{Math.round(interestPart).toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{Math.round(principalPart).toLocaleString()}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{Math.round(runningBalance).toLocaleString()}</td>
                          <td style={td}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '12px', fontSize: '11px',
                              background: r.status === 'paid' ? '#d1fae5' : '#fef9e7',
                              color: r.status === 'paid' ? '#065f46' : '#b45309'
                            }}>{r.status || 'pending'}</span>
                          </td>
                          <td style={td}>
                            {r.status !== 'paid' && (
                              <>
                                <button onClick={() => applyPenalty(scheduleModal.loanId, r.installmentNumber)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', marginRight: '4px' }}>⚠️ Penalty</button>
                                <button onClick={() => markPaid(scheduleModal.loanId, r.installmentNumber)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✅ Mark Paid</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <button onClick={() => setScheduleModal(null)} style={btn('#6b7280')}>Close</button>
          </div>
        </Modal>
      )}

      {pdfModal && (
        <PdfOptionsModal
          title={pdfModal.title}
          baseUrl={pdfModal.url}
          onClose={() => setPdfModal(null)}
        />
      )}

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '10px 24px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

const FundHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/loans/fund-history')
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '10px', color: '#6b7280', fontSize: '12px' }}>Loading...</div>;
  if (history.length === 0) return <div style={{ padding: '10px', color: '#6b7280', fontSize: '12px' }}>No fund history yet.</div>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          <th style={th}>Date</th>
          <th style={th}>Amount</th>
          <th style={th}>Description</th>
        </tr>
      </thead>
      <tbody>
        {history.map((h) => (
          <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={td}>{new Date(h.date).toLocaleDateString()}</td>
            <td style={{ ...td, color: '#15803d', fontWeight: '600' }}>+ UGX {Number(h.amount).toLocaleString()}</td>
            <td style={td}>{h.description || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const AmountModal = ({ title, onClose, value, setValue, onSubmit, color, placeholder, hint }) => (
  <Modal onClose={onClose} title={title}>
    <Field label="Amount (UGX)">
      <input type="number" value={value} onChange={e => setValue(e.target.value)}
        placeholder={placeholder ? placeholder.toString() : ''} style={input} />
      {hint && <small style={{ color: '#64748b' }}>{hint}</small>}
    </Field>
    <button onClick={onSubmit} style={btn(color)}>Confirm</button>
  </Modal>
);

const Card = ({ title, value, color, bg, icon, isMoney }) => (
  <div style={{ background: bg, padding: '8px 10px', borderRadius: '8px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '10px', color }}>{title}</div>
        <div style={{ fontSize: '14px', fontWeight: '700', color }}>{isMoney ? `UGX ${Number(value || 0).toLocaleString()}` : value}</div>
      </div>
      <span style={{ fontSize: '16px' }}>{icon}</span>
    </div>
  </div>
);

const Btn = ({ children, onClick, color }) => (<button onClick={onClick} style={btn(color)}>{children}</button>);
const btn = (bg) => ({ padding: '8px 14px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' });
const mini = (bg) => ({ padding: '4px 8px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', margin: '2px', cursor: 'pointer', fontSize: '11px' });
const Field = ({ label, children }) => (<div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>{label}</label>{children}</div>);
const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '750px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const th = { padding: '8px', textAlign: 'left', fontWeight: '600' };
const td = { padding: '8px' };