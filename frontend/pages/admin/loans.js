import { useEffect, useState } from 'react';

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    type: 'emergency',
    amount: '',
    duration: '',
    purpose: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLoans();
    fetchMembers();
    fetchSettings();
  }, []);

  const fetchLoans = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/loans');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setLoans(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/members');
      if (!res.ok) throw new Error('Members API unavailable');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setMembers([{ _id: 'YOUR_MEMBER_ID', name: 'Demo Member', memberNumber: 'M001' }]);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/settings');
      if (!res.ok) throw new Error('Settings unavailable');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === 'type') {
      let defaultDuration = '';
      if (value === 'emergency') defaultDuration = settings?.emergencyDurationMonths || 1;
      else if (value === 'school_fees') defaultDuration = settings?.schoolFeesDefaultMonths || 3;
      else if (value === 'business') defaultDuration = settings?.businessDefaultMonths || 6;
      setForm(prev => ({ ...prev, duration: defaultDuration }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        memberId: form.memberId,
        type: form.type,
        amount: parseFloat(form.amount),
        duration: parseInt(form.duration),
        scheduleUnit: 'weekly',
        purpose: form.purpose
      };
      const res = await fetch('http://localhost:5000/api/loans/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Loan submitted successfully!');
        setShowModal(false);
        setForm({ memberId: '', type: 'emergency', amount: '', duration: '', purpose: '' });
        fetchLoans();
      } else {
        setError(data.error || 'Failed to apply');
      }
    } catch (err) {
      setError('Network error – is backend running?');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (loanId, status) => {
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${loanId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchLoans();
      else {
        const data = await res.json();
        alert(data.error || 'Failed');
      }
    } catch (err) { alert('Network error'); }
  };

  const defaultLoan = async (loanId) => {
    if (!confirm('Are you sure you want to default this loan? Member savings will be deducted.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/loans/${loanId}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        alert('Loan defaulted. Member savings deducted.');
        fetchLoans();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed');
      }
    } catch (err) { alert('Network error'); }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings updated!');
        setShowSettings(false);
        fetchSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update');
      }
    } catch (err) { alert('Network error'); }
  };

  const filteredLoans = activeTab === 'all' ? loans : loans.filter(l => l.status === activeTab);
  const total = loans.length;
  const pending = loans.filter(l => l.status === 'pending').length;
  const active = loans.filter(l => l.status === 'active').length;
  const closed = loans.filter(l => l.status === 'closed').length;

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading loans...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#1a1a2e' }}>📋 Loan Management</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'linear-gradient(135deg, #e0f2fe, #b8e1fc)', padding: '18px 20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#0c4a6e' }}>Total Loans</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#0369a1' }}>{total}</div>
            </div>
            <span style={{ fontSize: '28px' }}>📊</span>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef9e7, #fdebb0)', padding: '18px 20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#78350f' }}>Pending</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#b45309' }}>{pending}</div>
            </div>
            <span style={{ fontSize: '28px' }}>⏳</span>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', padding: '18px 20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#14532d' }}>Active</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#15803d' }}>{active}</div>
            </div>
            <span style={{ fontSize: '28px' }}>✅</span>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', padding: '18px 20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#334155' }}>Closed</div>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#475569' }}>{closed}</div>
            </div>
            <span style={{ fontSize: '28px' }}>🔒</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 22px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(37,99,235,0.35)',
            transition: 'transform 0.1s ease',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ➕ New Loan Application
        </button>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '10px 22px',
            background: 'linear-gradient(135deg, #6b7280, #4b5563)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(107,114,128,0.35)',
            transition: 'transform 0.1s ease',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ⚙️ Loan Settings
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'disbursed', 'active', 'closed', 'writeOff'].map(tab => (
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
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Member</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Interest</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Total Repayable</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Applied By</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#334155' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.map((loan, idx) => {
                const statusColors = {
                  pending: { bg: '#fef9c3', text: '#854d0e' },
                  approved: { bg: '#dbeafe', text: '#1e40af' },
                  disbursed: { bg: '#c7d2fe', text: '#3730a3' },
                  active: { bg: '#d1fae5', text: '#065f46' },
                  closed: { bg: '#f1f5f9', text: '#475569' },
                  rejected: { bg: '#fee2e2', text: '#991b1b' },
                  writeOff: { bg: '#fecaca', text: '#7f1d1d' }
                };
                const color = statusColors[loan.status] || { bg: '#f3f4f6', text: '#374151' };
                return (
                  <tr key={loan._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                    <td style={{ padding: '12px 16px' }}>{loan.memberId?.name || 'Unknown'}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{loan.type}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>UGX {loan.amount}</td>
                    <td style={{ padding: '12px 16px' }}>{loan.interestRate}%</td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>UGX {loan.totalRepayable}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: color.bg,
                        color: color.text,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {loan.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{loan.appliedBy}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {loan.status === 'pending' && (
                          <>
                            <button onClick={() => updateStatus(loan._id, 'approved')} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Approve</button>
                            <button onClick={() => updateStatus(loan._id, 'rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Reject</button>
                          </>
                        )}
                        {loan.status === 'approved' && (
                          <button onClick={() => updateStatus(loan._id, 'disbursed')} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Disburse</button>
                        )}
                        {loan.status === 'disbursed' && (
                          <button onClick={() => updateStatus(loan._id, 'active')} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Set Active</button>
                        )}
                        {loan.status === 'active' && (
                          <button onClick={() => updateStatus(loan._id, 'closed')} style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Close</button>
                        )}
                        {!loan.defaulted && loan.status !== 'closed' && loan.status !== 'rejected' && (
                          <button onClick={() => defaultLoan(loan._id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Default</button>
                        )}
                        <button onClick={() => window.open(`http://localhost:5000/api/loans/${loan._id}/schedule`, '_blank')} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>📋</button>
                        <button onClick={() => window.open(`http://localhost:5000/api/loans/${loan._id}/statement`, '_blank')} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>📊</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Loan Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: '#1e293b' }}>Apply for a Loan</h2>
            {error && <p style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '6px' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Member</label>
                <select name="memberId" value={form.memberId} onChange={handleChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                  <option value="">Select a member</option>
                  {members.map(m => <option key={m._id} value={m._id}>{m.name} ({m.memberNumber})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Loan Type</label>
                <select name="type" value={form.type} onChange={handleChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                  <option value="emergency">Emergency (1 month fixed)</option>
                  <option value="school_fees">School Fees (1-3 months)</option>
                  <option value="business">Business (1-6 months)</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Amount (UGX)</label>
                <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                <small style={{ color: '#6b7280' }}>Max 70% of savings</small>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Duration (months)</label>
                <input type="number" name="duration" value={form.duration} onChange={handleChange} required min="1" step="1" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                <small style={{ color: '#6b7280' }}>
                  {form.type === 'emergency' && 'Fixed 1 month'}
                  {form.type === 'school_fees' && 'Choose 1, 2, or 3 months'}
                  {form.type === 'business' && 'Choose 1–6 months'}
                </small>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Purpose</label>
                <input type="text" name="purpose" value={form.purpose} onChange={handleChange} placeholder="e.g., School fees" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" disabled={submitting} style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && settings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: '#1e293b' }}>⚙️ Loan Settings</h2>
            <form onSubmit={handleSettingsSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Loan Limit (% of savings)</label>
                <input type="number" value={settings.loanLimitPercent} onChange={(e) => setSettings({...settings, loanLimitPercent: parseFloat(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Emergency Interest Rate (%)</label>
                <input type="number" step="0.1" value={settings.emergencyInterest} onChange={(e) => setSettings({...settings, emergencyInterest: parseFloat(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>School Fees Interest Rate (%)</label>
                <input type="number" step="0.1" value={settings.schoolFeesInterest} onChange={(e) => setSettings({...settings, schoolFeesInterest: parseFloat(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Business Interest Rate (%)</label>
                <input type="number" step="0.1" value={settings.businessInterest} onChange={(e) => setSettings({...settings, businessInterest: parseFloat(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Emergency Duration (months)</label>
                <input type="number" value={settings.emergencyDurationMonths} onChange={(e) => setSettings({...settings, emergencyDurationMonths: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>School Fees Default Duration (months)</label>
                <input type="number" value={settings.schoolFeesDefaultMonths} onChange={(e) => setSettings({...settings, schoolFeesDefaultMonths: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#334155' }}>Business Default Duration (months)</label>
                <input type="number" value={settings.businessDefaultMonths} onChange={(e) => setSettings({...settings, businessDefaultMonths: parseInt(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" style={{ padding: '10px 24px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Save Settings</button>
                <button type="button" onClick={() => setShowSettings(false)} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
