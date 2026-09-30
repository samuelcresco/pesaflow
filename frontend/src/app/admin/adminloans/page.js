'use client';

import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showApply, setShowApply] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
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
    } catch (err) {
      console.error(err);
    }
  };

  const checkEligibility = async (memberId, type) => {
    if (!memberId || !type) {
      setEligibility(null);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/loans/eligibility/${memberId}/${type}`);
      const data = await res.json();
      setEligibility(data);
    } catch (err) {
      console.error(err);
      setEligibility(null);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };

    if (name === 'type' && settings) {
      let dur = 1;
      if (value === 'emergency') dur = settings.emergencyDurationMonths || 1;
      else if (value === 'school_fees') dur = settings.schoolFeesDefaultMonths || 3;
      else if (value === 'business') dur = settings.businessDefaultMonths || 6;
      newForm.duration = dur;
    }

    setForm(newForm);

    if (name === 'memberId' || name === 'type') {
      checkEligibility(newForm.memberId, newForm.type);
    }
  };

  const submitLoan = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/loans/admin-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId,
          type: form.type,
          amount: parseFloat(form.amount),
          duration: parseInt(form.duration),
          purpose: form.purpose
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Loan submitted!');
        setShowApply(false);
        setForm({ memberId: '', type: 'emergency', amount: '', duration: 1, purpose: '' });
        setEligibility(null);
        fetchAll();
      } else {
        setError(data.error || 'Failed to submit');
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
    } catch (err) {
      console.error(err);
    }
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
        alert('Settings saved');
        setShowSettings(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadPDF = (loanId, type) => {
    window.open(`http://localhost:5000/api/loans/${loanId}/${type}-pdf`, '_blank');
  };

  const filteredLoans = activeTab === 'all' ? loans : loans.filter(l => l.status === activeTab);
  const total = loans.length;
  const pending = loans.filter(l => l.status === 'pending').length;
  const active = loans.filter(l => l.status === 'active').length;
  const closed = loans.filter(l => l.status === 'closed').length;

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>📋 Loan Management</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card title="Total Loans" value={total} color="#0369a1" bg="#e0f2fe" icon="📊" />
        <Card title="Pending" value={pending} color="#b45309" bg="#fef9e7" icon="⏳" />
        <Card title="Active" value={active} color="#15803d" bg="#dcfce7" icon="✅" />
        <Card title="Closed" value={closed} color="#475569" bg="#f1f5f9" icon="🔒" />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Btn onClick={() => setShowApply(true)} color="#2563eb">➕ New Loan Application</Btn>
        <Btn onClick={() => setShowSettings(true)} color="#6b7280">⚙️ Loan Settings</Btn>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'disbursed', 'active', 'closed', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === tab ? '#1e293b' : '#64748b',
              fontWeight: activeTab === tab ? '600' : '500',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {filteredLoans.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No loans found.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Member</th>
                <th style={th}>Type</th>
                <th style={th}>Amount</th>
                <th style={th}>Rate</th>
                <th style={th}>Total</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
                <th style={th}>Documents</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan, i) => (
                <tr key={loan._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={td}>{loan.memberId?.firstName || 'Unknown'} {loan.memberId?.surname || ''}</td>
                  <td style={td}>{loan.type}</td>
                  <td style={td}>UGX {loan.amount?.toLocaleString()}</td>
                  <td style={td}>{loan.interestRate}%</td>
                  <td style={td}>UGX {loan.totalRepayable?.toLocaleString()}</td>
                  <td style={td}><strong>{loan.status}</strong></td>
                  <td style={td}>
                    {loan.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(loan._id, 'approved')} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', margin: '2px', cursor: 'pointer', fontSize: '12px' }}>Approve</button>
                        <button onClick={() => updateStatus(loan._id, 'rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', margin: '2px', cursor: 'pointer', fontSize: '12px' }}>Reject</button>
                      </>
                    )}
                    {loan.status === 'approved' && (
                      <button onClick={() => updateStatus(loan._id, 'disbursed')} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Disburse</button>
                    )}
                    {loan.status === 'disbursed' && (
                      <button onClick={() => updateStatus(loan._id, 'active')} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Set Active</button>
                    )}
                    {loan.status === 'active' && (
                      <button onClick={() => updateStatus(loan._id, 'closed')} style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                    )}
                  </td>
                  <td style={td}>
                    <button onClick={() => downloadPDF(loan._id, 'schedule')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '6px', margin: '2px', cursor: 'pointer', fontSize: '12px' }}>📋 Schedule</button>
                    <button onClick={() => downloadPDF(loan._id, 'statement')} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '6px', margin: '2px', cursor: 'pointer', fontSize: '12px' }}>📄 Statement</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showApply && (
        <Modal onClose={() => { setShowApply(false); setEligibility(null); }} title="New Loan Application">
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <form onSubmit={submitLoan}>
            <Field label="Member">
              <select name="memberId" value={form.memberId} onChange={handleChange} required style={input}>
                <option value="">Select Member</option>
                {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>)}
              </select>
            </Field>

            {eligibility && (
              <div style={{
                background: eligibility.eligible ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${eligibility.eligible ? '#86efac' : '#fca5a5'}`,
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '14px'
              }}>
                {eligibility.eligible ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#166534' }}>✅ Eligible</div>
                    <div style={{ fontSize: '15px', color: '#166534', fontWeight: '600', marginTop: '4px' }}>
                      Max Amount: UGX {(eligibility.maxAmount || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      (70% of UGX {(eligibility.memberSavings || 0).toLocaleString()} savings)
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#991b1b', fontSize: '13px' }}>❌ {eligibility.reason}</div>
                )}
              </div>
            )}

            <Field label="Loan Type">
              <select name="type" value={form.type} onChange={handleChange} required style={input}>
                <option value="emergency">Emergency (1 month)</option>
                <option value="school_fees">School Fees (1-3 months)</option>
                <option value="business">Business (1-6 months)</option>
              </select>
            </Field>

            <Field label="Amount (UGX)">
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                required
                placeholder={eligibility?.maxAmount ? `Max: ${eligibility.maxAmount}` : ''}
                style={{
                  ...input,
                  color: eligibility?.maxAmount && parseFloat(form.amount) > eligibility.maxAmount ? 'red' : '#1e293b',
                  background: eligibility?.maxAmount ? '#f8fafc' : '#fff'
                }}
              />
              {eligibility?.maxAmount && (
                <small style={{ color: '#94a3b8' }}>
                  Max: UGX {eligibility.maxAmount.toLocaleString()} (faded limit)
                </small>
              )}
            </Field>

            <Field label="Duration (months)">
              <input type="number" name="duration" value={form.duration} onChange={handleChange} required style={input} />
            </Field>

            <Field label="Purpose">
              <input type="text" name="purpose" value={form.purpose} onChange={handleChange} style={input} />
            </Field>

            <Btn type="submit" color="#2563eb">Submit</Btn>
          </form>
        </Modal>
      )}

      {showSettings && settings && (
        <Modal onClose={() => setShowSettings(false)} title="⚙️ Loan Settings">
          <form onSubmit={saveSettings}>
            <Field label="Loan Limit (% of savings)">
              <input type="number" value={settings.loanLimitPercent} onChange={e => setSettings({ ...settings, loanLimitPercent: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="Emergency Interest (%)">
              <input type="number" value={settings.emergencyInterest} onChange={e => setSettings({ ...settings, emergencyInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="School Fees Interest (%)">
              <input type="number" value={settings.schoolFeesInterest} onChange={e => setSettings({ ...settings, schoolFeesInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Field label="Business Interest (%)">
              <input type="number" value={settings.businessInterest} onChange={e => setSettings({ ...settings, businessInterest: parseFloat(e.target.value) })} style={input} />
            </Field>
            <Btn type="submit" color="#22c55e">Save Settings</Btn>
          </form>
        </Modal>
      )}
    </div>
  );
}

const Card = ({ title, value, color, bg, icon }) => (
  <div style={{ background: bg, padding: '18px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value}</div>
    </div>
    <span style={{ fontSize: '28px' }}>{icon}</span>
  </div>
);

const Btn = ({ children, onClick, color, type = 'button' }) => (
  <button type={type} onClick={onClick} style={{ padding: '10px 20px', background: color, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>{children}</button>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const td = { padding: '12px' };