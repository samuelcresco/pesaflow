'use client';

import { useEffect, useState } from 'react';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showApply, setShowApply] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scheduleLoan, setScheduleLoan] = useState(null);
  const [scheduleData, setScheduleData] = useState(null);
  const [statementLoan, setStatementLoan] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    memberId: '',
    type: 'emergency',
    amount: '',
    duration: 1,
    purpose: ''
  });

  useEffect(() => {
    fetchAll();
    fetchSettings();
  }, []);

  const fetchAll = async () => {
    try {
      const [l, m] = await Promise.all([
        fetch('http://localhost:5000/api/loans').then(r => r.json()),
        fetch('http://localhost:5000/api/members').then(r => r.json())
      ]);
      setLoans(Array.isArray(l) ? l : []);
      setMembers(Array.isArray(m) ? m : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };

    // Auto-set duration based on loan type
    if (name === 'type' && settings) {
      if (value === 'emergency') updated.duration = settings.emergencyDurationMonths || 1;
      else if (value === 'school_fees') updated.duration = settings.schoolFeesDefaultMonths || 3;
      else if (value === 'business') updated.duration = settings.businessDefaultMonths || 6;
    }

    setForm(updated);

    // Fetch eligibility when member or type changes
    if ((name === 'memberId' || name === 'type') && updated.memberId && updated.type) {
      try {
        const res = await fetch(`http://localhost:5000/api/loans/eligibility/${updated.memberId}/${updated.type}`);
        const data = await res.json();
        setEligibility(data);
      } catch (err) {
        setEligibility(null);
      }
    }
  };

  // Calculate preview totals
  const previewTotals = () => {
    if (!form.amount || !settings) return { interest: 0, total: 0 };
    const amt = parseFloat(form.amount) || 0;
    const months = parseInt(form.duration) || 1;
    let rate = 0;
    if (form.type === 'emergency') rate = settings.emergencyInterest || 5;
    else if (form.type === 'school_fees') rate = settings.schoolFeesInterest || 8;
    else if (form.type === 'business') rate = settings.businessInterest || 10;
    const timeYears = months / 12;
    const interest = amt * (rate / 100) * timeYears;
    return {
      rate,
      interest: Math.round(interest * 100) / 100,
      total: Math.round((amt + interest) * 100) / 100,
      installments: months * 4,
      perInstallment: Math.round(((amt + interest) / (months * 4)) * 100) / 100
    };
  };

  const submitLoan = async (e) => {
    e.preventDefault();
    setError('');
    if (eligibility && !eligibility.eligible) {
      setError('Member is not eligible: ' + eligibility.reason);
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/loans/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId,
          type: form.type,
          amount: parseFloat(form.amount),
          duration: parseInt(form.duration),
          scheduleUnit: 'weekly',
          purpose: form.purpose
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Loan submitted successfully!');
        setShowApply(false);
        setForm({ memberId: '', type: 'emergency', amount: '', duration: 1, purpose: '' });
        setEligibility(null);
        fetchAll();
      } else {
        setError(data.error || 'Failed to submit loan');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const updateStatus = async (loanId, status) => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${loanId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchAll();
      else {
        const d = await res.json();
        alert(d.error || 'Failed');
      }
    } catch (err) { alert('Network error'); }
  };

  const viewSchedule = async (loan) => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${loan._id}`);
      const data = await res.json();
      setScheduleLoan(loan);
      setScheduleData(data);
    } catch (err) { alert('Failed to load schedule'); }
  };

  const viewStatement = async (loan) => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${loan._id}/statement`);
      const data = await res.json();
      setStatementLoan(loan);
      setStatementData(data);
    } catch (err) { alert('Failed to load statement'); }
  };

  const markPaid = async (installmentId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/repayment/${installmentId}`, {
        method: 'PUT'
      });
      if (res.ok) {
        alert('Installment marked as paid!');
        // Reload schedule
        const res2 = await fetch(`http://localhost:5000/api/loans/${scheduleLoan._id}`);
        const data = await res2.json();
        setScheduleData(data);
        fetchAll();
      }
    } catch (err) { alert('Failed'); }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings saved!');
        setShowSettings(false);
      }
    } catch (err) { alert('Error'); }
  };

  const filteredLoans = activeTab === 'all' ? loans : loans.filter(l => l.status === activeTab);
  const total = loans.length;
  const pending = loans.filter(l => l.status === 'pending').length;
  const active = loans.filter(l => l.status === 'active').length;
  const closed = loans.filter(l => l.status === 'closed').length;

  const statusColor = {
    pending: { bg: '#fef9c3', text: '#854d0e' },
    approved: { bg: '#dbeafe', text: '#1e40af' },
    disbursed: { bg: '#c7d2fe', text: '#3730a3' },
    active: { bg: '#d1fae5', text: '#065f46' },
    closed: { bg: '#f1f5f9', text: '#475569' },
    rejected: { bg: '#fee2e2', text: '#991b1b' },
    writeOff: { bg: '#fecaca', text: '#7f1d1d' }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading loans...</div>;

  const preview = previewTotals();

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#1a1a2e' }}>📋 Loan Management</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <SummaryCard title="Total Loans" value={total} color="#0369a1" bg="linear-gradient(135deg, #e0f2fe, #b8e1fc)" icon="📊" />
        <SummaryCard title="Pending" value={pending} color="#b45309" bg="linear-gradient(135deg, #fef9e7, #fdebb0)" icon="⏳" />
        <SummaryCard title="Active" value={active} color="#15803d" bg="linear-gradient(135deg, #dcfce7, #bbf7d0)" icon="✅" />
        <SummaryCard title="Closed" value={closed} color="#475569" bg="linear-gradient(135deg, #f1f5f9, #e2e8f0)" icon="🔒" />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button onClick={() => setShowApply(true)} style={btnStyle('#2563eb')}>➕ New Loan Application</button>
        <button onClick={() => setShowSettings(true)} style={btnStyle('#6b7280')}>⚙️ Loan Settings</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'disbursed', 'active', 'closed', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === tab ? '#1e293b' : '#64748b',
              fontWeight: activeTab === tab ? '600' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            {tab === 'rejected' ? 'WriteOff' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredLoans.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '20px 0' }}>No loans found in this category.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Rate</th>
                <th style={thStyle}>Total Repayable</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Applied By</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan, idx) => {
                const color = statusColor[loan.status] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <tr key={loan._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                    <td style={tdStyle}>{loan.memberId?.firstName} {loan.memberId?.surname}</td>
                    <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{loan.type?.replace('_', ' ')}</td>
                    <td style={tdStyle}>UGX {loan.amount?.toLocaleString()}</td>
                    <td style={tdStyle}>{loan.interestRate}%</td>
                    <td style={tdStyle}>UGX {loan.totalRepayable?.toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{ background: color.bg, color: color.text, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
                        {loan.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{loan.appliedBy || 'member'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {loan.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(loan._id, 'approved')} style={smallBtn('#22c55e')}>Approve</button>
                            <button onClick={() => updateStatus(loan._id, 'rejected')} style={smallBtn('#ef4444')}>Reject</button>
                          </>
                        )}
                        {loan.status === 'approved' && (
                          <button onClick={() => updateStatus(loan._id, 'disbursed')} style={smallBtn('#f59e0b')}>Disburse</button>
                        )}
                        {loan.status === 'disbursed' && (
                          <button onClick={() => updateStatus(loan._id, 'active')} style={smallBtn('#8b5cf6')}>Set Active</button>
                        )}
                        {loan.status === 'active' && (
                          <button onClick={() => updateStatus(loan._id, 'closed')} style={smallBtn('#6b7280')}>Close</button>
                        )}
                        <button onClick={() => viewSchedule(loan)} style={smallBtn('#3b82f6')}>📋 Schedule</button>
                        <button onClick={() => viewStatement(loan)} style={smallBtn('#7c3aed')}>📊 Statement</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ APPLY LOAN MODAL ============ */}
      {showApply && (
        <Modal onClose={() => { setShowApply(false); setEligibility(null); }} title="Apply for a Loan">
          {error && <p style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>{error}</p>}
          <form onSubmit={submitLoan}>
            <Field label="Member">
              <select name="memberId" value={form.memberId} onChange={handleChange} required style={input}>
                <option value="">Select Member</option>
                {members.map(m => (
                  <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>
                ))}
              </select>
            </Field>

            <Field label="Loan Type">
              <select name="type" value={form.type} onChange={handleChange} required style={input}>
                <option value="emergency">Emergency (1 month fixed)</option>
                <option value="school_fees">School Fees (1-3 months)</option>
                <option value="business">Business (1-6 months)</option>
              </select>
            </Field>

            {/* Eligibility Display */}
            {eligibility && (
              <div style={{
                background: eligibility.eligible ? '#dcfce7' : '#fee2e2',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '13px'
              }}>
                <strong>{eligibility.eligible ? '✅ Eligible' : '❌ Not Eligible'}</strong>
                {eligibility.reason && <div style={{ color: '#991b1b' }}>{eligibility.reason}</div>}
                <div style={{ marginTop: '6px', color: '#1e40af' }}>
                  💰 Max Loan (70% of savings): <strong>UGX {eligibility.maxAmount?.toLocaleString()}</strong>
                </div>
              </div>
            )}

            <Field label="Amount (UGX)">
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                min="1"
                max={eligibility?.maxAmount || undefined}
                style={{
                  ...input,
                  background: eligibility?.maxAmount ? '#f8fafc' : '#fff'
                }}
              />
              {eligibility?.maxAmount && (
                <small style={{ color: '#6b7280', display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                  Limit shown above is 70% of savings
                </small>
              )}
            </Field>

            <Field label="Duration (months)">
              <input type="number" name="duration" value={form.duration} onChange={handleChange} required min="1" style={input} />
              <small style={{ color: '#6b7280' }}>
                {form.type === 'emergency' && 'Fixed at 1 month'}
                {form.type === 'school_fees' && 'Choose 1, 2, or 3 months'}
                {form.type === 'business' && 'Choose 1–6 months'}
              </small>
            </Field>

            {/* Interest Preview */}
            {form.amount && preview.rate > 0 && (
              <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                <div><strong>Interest Rate:</strong> {preview.rate}% (simple, flat)</div>
                <div><strong>Interest Amount:</strong> UGX {preview.interest.toLocaleString()}</div>
                <div><strong>Total Repayable:</strong> UGX {preview.total.toLocaleString()}</div>
                <div><strong>Weekly Installments:</strong> {preview.installments} × UGX {preview.perInstallment.toLocaleString()}</div>
              </div>
            )}

            <Field label="Purpose">
              <input type="text" name="purpose" value={form.purpose} onChange={handleChange} style={input} placeholder="e.g., Business capital" />
            </Field>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" style={btnStyle('#2563eb')}>Submit Loan</button>
              <button type="button" onClick={() => { setShowApply(false); setEligibility(null); }} style={btnStyle('#e5e7eb', '#1f2937')}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ SETTINGS MODAL ============ */}
      {showSettings && settings && (
        <Modal onClose={() => setShowSettings(false)} title="⚙️ Loan Settings">
          <form onSubmit={saveSettings}>
            <Field label="Loan Limit (% of savings)">
              <input type="number" value={settings.loanLimitPercent} onChange={e => setSettings({ ...settings, loanLimitPercent: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="Emergency Interest Rate (%)">
              <input type="number" step="0.1" value={settings.emergencyInterest} onChange={e => setSettings({ ...settings, emergencyInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="School Fees Interest Rate (%)">
              <input type="number" step="0.1" value={settings.schoolFeesInterest} onChange={e => setSettings({ ...settings, schoolFeesInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="Business Interest Rate (%)">
              <input type="number" step="0.1" value={settings.businessInterest} onChange={e => setSettings({ ...settings, businessInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="Emergency Duration (months)">
              <input type="number" value={settings.emergencyDurationMonths} onChange={e => setSettings({ ...settings, emergencyDurationMonths: parseInt(e.target.value) })} style={input} />
            </Field>
            <Field label="School Fees Default Duration (months)">
              <input type="number" value={settings.schoolFeesDefaultMonths} onChange={e => setSettings({ ...settings, schoolFeesDefaultMonths: parseInt(e.target.value) })} style={input} />
            </Field>
            <Field label="Business Default Duration (months)">
              <input type="number" value={settings.businessDefaultMonths} onChange={e => setSettings({ ...settings, businessDefaultMonths: parseInt(e.target.value) })} style={input} />
            </Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" style={btnStyle('#22c55e')}>Save Settings</button>
              <button type="button" onClick={() => setShowSettings(false)} style={btnStyle('#e5e7eb', '#1f2937')}>Close</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ SCHEDULE MODAL ============ */}
      {scheduleLoan && scheduleData && (
        <Modal onClose={() => { setScheduleLoan(null); setScheduleData(null); }} title={`📋 Repayment Schedule — ${scheduleLoan.memberId?.firstName}`}>
          <div style={{ fontSize: '13px', marginBottom: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
            <div><strong>Amount:</strong> UGX {scheduleLoan.amount?.toLocaleString()}</div>
            <div><strong>Total Repayable:</strong> UGX {scheduleLoan.totalRepayable?.toLocaleString()}</div>
            <div><strong>Schedule:</strong> {scheduleData.repayments?.length} weekly installments</div>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Due Date</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {scheduleData.repayments?.map((r, i) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '8px' }}>{r.installmentNumber}</td>
                    <td style={{ padding: '8px' }}>{new Date(r.dueDate).toLocaleDateString()}</td>
                    <td style={{ padding: '8px' }}>UGX {r.amountDue?.toLocaleString()}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        background: r.status === 'paid' ? '#d1fae5' : '#fef9c3',
                        color: r.status === 'paid' ? '#065f46' : '#854d0e'
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {r.status !== 'paid' && (
                        <button onClick={() => markPaid(r._id)} style={smallBtn('#22c55e')}>Mark Paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => window.open(`http://localhost:5000/api/loans/${scheduleLoan._id}/schedule`, '_blank')} style={{ ...btnStyle('#3b82f6'), marginTop: '14px' }}>🖨️ Download PDF</button>
        </Modal>
      )}

      {/* ============ STATEMENT MODAL ============ */}
      {statementLoan && statementData && (
        <Modal onClose={() => { setStatementLoan(null); setStatementData(null); }} title={`📊 Loan Statement — ${statementLoan.memberId?.firstName}`}>
          <div style={{ fontSize: '13px', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
            <div><strong>Amount Borrowed:</strong> UGX {statementData.loan?.amount?.toLocaleString()}</div>
            <div><strong>Interest Rate:</strong> {statementData.loan?.interestRate}%</div>
            <div><strong>Total Repayable:</strong> UGX {statementData.loan?.totalRepayable?.toLocaleString()}</div>
            <div><strong>Total Paid:</strong> UGX {statementData.loan?.totalPaid?.toLocaleString()}</div>
            <div><strong>Balance:</strong> UGX {statementData.loan?.balance?.toLocaleString()}</div>
            <div><strong>Status:</strong> {statementData.loan?.status}</div>
          </div>
          <h4 style={{ marginBottom: '8px' }}>Timeline:</h4>
          <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '13px' }}>
            {statementData.timeline?.map((t, i) => (
              <div key={i} style={{ padding: '8px', borderLeft: '3px solid #3b82f6', marginBottom: '6px', background: '#f8fafc' }}>
                <strong>{new Date(t.date).toLocaleDateString()}</strong> — {t.event}
              </div>
            ))}
          </div>
          <button onClick={() => window.open(`http://localhost:5000/api/loans/${statementLoan._id}/statement`, '_blank')} style={{ ...btnStyle('#7c3aed'), marginTop: '14px' }}>🖨️ Download PDF</button>
        </Modal>
      )}
    </div>
  );
}

/* ==================== STYLES & HELPERS ==================== */

const btnStyle = (bg, color = '#fff') => ({
  padding: '10px 20px',
  background: bg,
  color,
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer'
});

const smallBtn = (bg) => ({
  background: bg,
  color: '#fff',
  border: 'none',
  padding: '4px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '500'
});

const thStyle = { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const tdStyle = { padding: '12px' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const SummaryCard = ({ title, value, color, bg, icon }) => (
  <div style={{ background: bg, padding: '18px 20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '30px', fontWeight: '700', color }}>{value}</div>
    </div>
    <span style={{ fontSize: '28px' }}>{icon}</span>
  </div>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '560px', maxWidth: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
