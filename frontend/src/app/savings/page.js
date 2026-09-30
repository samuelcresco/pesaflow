'use client';

import { useEffect, useState } from 'react';
import PdfOptionsModal from '../../components/PdfOptionsModal';
import { apiFetch } from '../api-client';

const DESCRIPTION_OPTIONS = [
  'Monthly Contribution',
  'Late Payment',
  'Personal Savings',
  'Share Purchase',
  'External Donation',
  'Member Donation',
  'Late Coming',
  'Misconduct',
  'Miscellaneous',
  'Facilitation'
];

export default function SavingsPage() {
  const [summary, setSummary] = useState({ generalSavings: 0, memberSavings: 0, clubCapital: 0 });
  const [memberSavings, setMemberSavings] = useState([]);
  const [members, setMembers] = useState([]);
  const [agreedSavings, setAgreedSavings] = useState([]);
  const [membershipFees, setMembershipFees] = useState({ firstTime: 0, renewal: 0 });
  const [sharePrices, setSharePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [pdfModal, setPdfModal] = useState(null);
  const [searchMember, setSearchMember] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    memberId: '',
    amount: '',
    description: 'Monthly Contribution',
    shareType: 'golden',
    shareQuantity: 1,
    date: new Date().toISOString().split('T')[0],
    donationType: 'member',
    donorName: '',
    membershipType: 'first_time'
  });
  const [setup, setSetup] = useState({ year: new Date().getFullYear(), amount: '', firstTime: 0, renewal: 0 });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [s, m, mem, a, fees, shareSettings] = await Promise.all([
        apiFetch('/api/savings/summary').then(r => r.json()),
        apiFetch('/api/savings/members').then(r => r.json()),
        apiFetch('/api/members').then(r => r.json()),
        apiFetch('/api/savings/agreed-savings').then(r => r.json()).catch(() => []),
        apiFetch('/api/savings/membership-fees').then(r => r.json()).catch(() => ({ firstTime: 0, renewal: 0 })),
        apiFetch('/api/settings/shares').then(r => r.json()).catch(() => ({}))
      ]);
      setSummary(s);
      setMemberSavings(Array.isArray(m) ? m : []);
      setMembers(Array.isArray(mem) ? mem : []);
      setAgreedSavings(Array.isArray(a) ? a : []);
      setMembershipFees(fees || { firstTime: 0, renewal: 0 });
      setSetup(prev => ({ ...prev, firstTime: fees?.firstTime || 0, renewal: fees?.renewal || 0 }));
      if (shareSettings.shareTypes) setSharePrices(shareSettings.shareTypes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addSaving = async (e) => {
    e.preventDefault();
    const payload = { ...form, category: modal };

    if (modal === 'business_profit') delete payload.memberId;
    if (modal === 'donation' && form.donationType === 'external') delete payload.memberId;

    if (modal === 'membership') {
      const year = new Date(form.date).getFullYear();
      const yearSetting = agreedSavings.find(a => a.year === year);
      payload.amount = form.amount || (form.membershipType === 'renewal'
        ? (yearSetting?.membershipRenewalFee || 0)
        : (yearSetting?.membershipFee || 0));
    }

    try {
      const res = await apiFetch('/api/savings/add', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('✅ Saved!');
        setModal(null);
        setForm({
          memberId: '', amount: '', description: 'Monthly Contribution',
          shareType: 'golden', shareQuantity: 1,
          date: new Date().toISOString().split('T')[0],
          donationType: 'member', donorName: '', membershipType: 'first_time'
        });
        fetchAll();
      } else {
        const d = await res.json();
        alert('❌ ' + (d.error || 'Failed'));
      }
    } catch (err) {
      alert('❌ Network error');
    }
  };

  const saveSetup = async (type) => {
    try {
      let url, body;
      if (type === 'agreed-monthly') {
        url = '/api/savings/settings/agreed-monthly';
        body = { year: setup.year, amount: parseFloat(setup.amount) };
      } else if (type === 'membership-fees') {
        url = '/api/savings/settings/membership-fees';
        body = {
          year: setup.year,
          firstTime: parseFloat(setup.firstTime),
          renewal: parseFloat(setup.renewal)
        };
      }
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert('✅ Saved!');
        fetchAll();
      }
    } catch (err) { alert('Error'); }
  };

  const handleDateChange = (value) => {
    const updates = { date: value };
    const year = new Date(value).getFullYear();
    const yearSetting = agreedSavings.find(a => a.year === year);

    if (modal === 'monthly' && yearSetting) {
      updates.amount = yearSetting.amount;
    }

    if (modal === 'membership' && yearSetting) {
      updates.amount = form.membershipType === 'renewal'
        ? (yearSetting.membershipRenewalFee || 0)
        : (yearSetting.membershipFee || 0);
    }

    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleMembershipType = (value) => {
    const year = new Date(form.date).getFullYear();
    const yearSetting = agreedSavings.find(a => a.year === year);
    const amount = value === 'renewal'
      ? (yearSetting?.membershipRenewalFee || 0)
      : (yearSetting?.membershipFee || 0);
    setForm(prev => ({ ...prev, membershipType: value, amount: amount || '' }));
  };

  const handleShareChange = (shareType, quantity) => {
    const price = sharePrices[shareType]?.price || 0;
    const amount = price * quantity;
    setForm(prev => ({ ...prev, shareType, shareQuantity: quantity, amount: amount || '' }));
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  const currentYear = new Date(form.date).getFullYear();
  const currentYearSetting = agreedSavings.find(a => a.year === currentYear);

  const filteredMembers = memberSavings.filter(m => {
    if (!searchMember) return true;
    const q = searchMember.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.memberNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ color: '#1e293b' }}>💰 Savings & Income</h1>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Btn onClick={() => setModal('monthly')} color="#2563eb">➕ Add Monthly Savings</Btn>
        <Btn onClick={() => setModal('extra')} color="#22c55e">➕ Add Extra Savings</Btn>
        <Btn onClick={() => setModal('penalty')} color="#ef4444">➕ Add Penalty</Btn>
        <Btn onClick={() => setModal('shares')} color="#8b5cf6">🛒 Buy Shares</Btn>
        <Btn onClick={() => setModal('membership')} color="#0891b2">🆔 Add Membership</Btn>
        <Btn onClick={() => setModal('donation')} color="#f59e0b">➕ Add Donation</Btn>
        <Btn onClick={() => setModal('misc')} color="#eab308">➕ Add Miscellaneous</Btn>
        <Btn onClick={() => setModal('settings')} color="#6b7280">⚙️ Savings Settings</Btn>
        <a href="/savings/multi-entry" style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none' }}>🧾 Add Multiple</a>
        <a href="/withdrawals" style={{ padding: '10px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none' }}>💸 Withdrawals</a>
      </div>

      {/* PDF Reports + Links */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Btn onClick={() => setPdfModal({ title: 'Club Capital Report', url: 'http://localhost:5000/api/savings/club-capital-report' })} color="#1e40af">📄 Club Capital Report</Btn>
        <Btn onClick={() => setPdfModal({ title: 'General Report', url: 'http://localhost:5000/api/savings/general-report' })} color="#7c3aed">📊 General Report</Btn>
        <a href="/receipts" style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>🧾 Receipts</a>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Card title="General Savings" value={summary.generalSavings || 0} color="#0369a1" bg="#e0f2fe" icon="🏦" />
        <Card title="Total Member Savings" value={summary.memberSavings || 0} color="#15803d" bg="#dcfce7" icon="👥" />
        <Card title="Total Club Capital" value={summary.clubCapital || 0} color="#b45309" bg="#fef9e7" icon="🏛️" />
      </div>

      {/* Member Savings Table */}
      <h2 style={{ color: '#1e293b' }}>Member Savings</h2>

      {/* Search bar */}
      <div style={{ marginTop: '12px', marginBottom: '8px' }}>
        <input
          type="text"
          value={searchMember}
          onChange={e => setSearchMember(e.target.value)}
          placeholder="🔍 Search by name, member number..."
          style={{
            width: '100%', maxWidth: '420px', padding: '10px 14px',
            border: '1px solid #d1d5db', borderRadius: '8px',
            fontSize: '14px', background: '#f8fafc'
          }}
        />
        {searchMember && (
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Showing {filteredMembers.length} of {memberSavings.length} members
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#0f3460', color: '#fff' }}>
              {['Member','Member No.','Monthly','Extra','Miscellaneous','Donation','Penalties','Membership','Shares Value','Total Savings','Actions'].map(h => (
                <th key={h} style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? (
              <tr><td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                {searchMember ? `No members match "${searchMember}".` : 'No savings yet.'}
              </td></tr>
            ) : filteredMembers.map((m, i) => (
              <tr key={m._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.memberNumber}</td>
                <td style={td}>UGX {(m.monthlySavings || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.extraSavings || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.misc || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.donation || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.penalties || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.membership || 0).toLocaleString()}</td>
                <td style={td}>UGX {(m.sharesValue || 0).toLocaleString()}</td>
                <td style={{...td, fontWeight: '700', color: '#15803d'}}>
                  UGX {((m.monthlySavings || 0) + (m.extraSavings || 0)).toLocaleString()}
                </td>
                <td style={{ padding: '12px', minWidth: '240px' }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap' }}>
                    <a href={`/all-transactions?member=${m._id}`} style={{ padding: '5px 10px', background: '#3b82f6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', whiteSpace: 'nowrap' }}>View</a>
                    <button onClick={() => setPdfModal({ title: `Statement — ${m.name}`, url: `http://localhost:5000/api/savings/member-statement/${m._id}` })} style={{ padding: '5px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>PDF</button>
                    <a href={`/receipts?member=${m._id}`} style={{ padding: '5px 10px', background: '#0891b2', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', whiteSpace: 'nowrap' }}>🧾</a>
                    <a href={`/withdrawals?member=${m._id}`} style={{ padding: '5px 10px', background: '#dc2626', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', whiteSpace: 'nowrap' }}>💸</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Saving Modal */}
      {modal && modal !== 'settings' && (
        <Modal onClose={() => setModal(null)} title={`Add ${labelFor(modal)}`}>
          <form onSubmit={addSaving}>
            {modal === 'donation' && (
              <Field label="Donation Type">
                <select value={form.donationType} onChange={e => setForm({ ...form, donationType: e.target.value })} style={input}>
                  <option value="member">Member Donation</option>
                  <option value="external">External Donation</option>
                </select>
              </Field>
            )}

            {['monthly','extra','penalty','membership','shares','misc'].includes(modal) && (
              <Field label="Member">
                <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} required style={input}>
                  <option value="">Select Member</option>
                  {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>)}
                </select>
              </Field>
            )}

            {modal === 'donation' && form.donationType === 'member' && (
              <Field label="Member">
                <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} required style={input}>
                  <option value="">Select Member</option>
                  {members.map(m => <option key={m._id} value={m._id}>{m.firstName} {m.surname} ({m.memberNumber})</option>)}
                </select>
              </Field>
            )}

            {modal === 'donation' && form.donationType === 'external' && (
              <Field label="Donor Name">
                <input type="text" value={form.donorName} onChange={e => setForm({ ...form, donorName: e.target.value })} required style={input} placeholder="e.g., Jane Doe" />
              </Field>
            )}

            {modal === 'membership' && (
              <Field label="Payment Type">
                <select value={form.membershipType} onChange={e => handleMembershipType(e.target.value)} style={input}>
                  <option value="first_time">First-time Membership (UGX {(currentYearSetting?.membershipFee || 0).toLocaleString()})</option>
                  <option value="renewal">Annual Renewal (UGX {(currentYearSetting?.membershipRenewalFee || 0).toLocaleString()})</option>
                </select>
              </Field>
            )}

            {modal === 'shares' && (
              <>
                <Field label="Share Type">
                  <select value={form.shareType} onChange={e => handleShareChange(e.target.value, form.shareQuantity)} style={input}>
                    <option value="golden">Golden</option>
                    <option value="platinum">Platinum</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                  </select>
                </Field>
                <Field label="Quantity">
                  <input type="number" min="1" value={form.shareQuantity} onChange={e => handleShareChange(form.shareType, parseInt(e.target.value) || 0)} style={input} />
                </Field>
              </>
            )}

            <Field label="Date">
              <input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} min="2015-01-01" required style={input} />
            </Field>

            <Field label="Amount (UGX)">
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required style={input} />
              {modal === 'monthly' && agreedSavings.length > 0 && <small style={{ color: '#64748b' }}>Auto-filled from agreed savings for the year. Editable.</small>}
              {modal === 'shares' && sharePrices[form.shareType] && <small style={{ color: '#64748b' }}>Auto-calculated: {form.shareQuantity} × UGX {(sharePrices[form.shareType].price || 0).toLocaleString()}</small>}
              {modal === 'membership' && <small style={{ color: '#64748b' }}>Auto-filled from year's fee. Editable.</small>}
            </Field>

            <Field label="Description">
              <select value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input}>
                {DESCRIPTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>

            <Btn type="submit" color="#2563eb">Save</Btn>
          </form>
        </Modal>
      )}

      {/* Settings Modal */}
      {modal === 'settings' && (
        <Modal onClose={() => setModal(null)} title="⚙️ Savings Settings">
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>📅 Year Settings</h3>
              <button type="button" onClick={() => setSetup({ ...setup, year: new Date().getFullYear() + 1, amount: '', firstTime: '', renewal: '' })} style={{ ...btnMini('#0891b2'), fontSize: '12px', padding: '6px 12px' }}>➕ Add New Year</button>
            </div>

            {agreedSavings.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '13px' }}>No year settings yet. Add a year below.</p>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr style={{ background: '#0f3460', color: '#fff' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Year</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Agreed Monthly</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>First-time Fee</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Renewal Fee</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...agreedSavings].sort((a, b) => b.year - a.year).map(a => (
                      <tr key={a._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{a.year}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>UGX {(a.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>UGX {(a.membershipFee || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>UGX {(a.membershipRenewalFee || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button type="button" onClick={() => setSetup({ year: a.year, amount: a.amount || '', firstTime: a.membershipFee || '', renewal: a.membershipRenewalFee || '' })} style={{ ...btnMini('#3b82f6'), marginRight: '4px' }}>✏️ Edit</button>
                          <button type="button" onClick={async () => {
                            if (!confirm(`Delete settings for ${a.year}?`)) return;
                            try {
                              const res = await apiFetch(`/api/savings/settings/${a.year}`, { method: 'DELETE' });
                              if (res.ok) { alert('✅ Deleted'); fetchAll(); }
                              else { const d = await res.json(); alert('❌ ' + d.error); }
                            } catch (err) { alert('Network error'); }
                          }} style={btnMini('#dc2626')}>🗑 Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155' }}>
              {agreedSavings.find(x => x.year === setup.year) ? `Edit ${setup.year} Settings` : `Add New Year`}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelSm}>Year</label>
                <input type="number" value={setup.year} onChange={e => setSetup({ ...setup, year: parseInt(e.target.value) })} style={inputSm} />
              </div>
              <div>
                <label style={labelSm}>Agreed Monthly</label>
                <input type="number" placeholder="e.g. 25000" value={setup.amount} onChange={e => setSetup({ ...setup, amount: e.target.value })} style={inputSm} />
              </div>
              <div>
                <label style={labelSm}>First-time Fee</label>
                <input type="number" placeholder="e.g. 30000" value={setup.firstTime} onChange={e => setSetup({ ...setup, firstTime: e.target.value })} style={inputSm} />
              </div>
              <div>
                <label style={labelSm}>Renewal Fee</label>
                <input type="number" placeholder="e.g. 15000" value={setup.renewal} onChange={e => setSetup({ ...setup, renewal: e.target.value })} style={inputSm} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={async () => {
                if (!setup.year) return alert('Enter a year');
                try {
                  if (setup.amount !== '' && setup.amount !== undefined) {
                    await apiFetch('/api/savings/settings/agreed-monthly', {
                      method: 'POST',
                      body: JSON.stringify({ year: setup.year, amount: parseFloat(setup.amount) })
                    });
                  }
                  if ((setup.firstTime !== '' && setup.firstTime !== undefined) || (setup.renewal !== '' && setup.renewal !== undefined)) {
                    await apiFetch('/api/savings/settings/membership-fees', {
                      method: 'POST',
                      body: JSON.stringify({
                        year: setup.year,
                        firstTime: parseFloat(setup.firstTime) || 0,
                        renewal: parseFloat(setup.renewal) || 0
                      })
                    });
                  }
                  alert('✅ Saved');
                  setSetup({ year: new Date().getFullYear(), amount: '', firstTime: '', renewal: '' });
                  fetchAll();
                } catch (err) { alert('❌ Network error'); }
              }} style={btnMini('#22c55e')}>💾 Save Year</button>
              <button type="button" onClick={() => setSetup({ year: new Date().getFullYear(), amount: '', firstTime: '', renewal: '' })} style={btnMini('#6b7280')}>Clear Form</button>
            </div>
          </div>
        </Modal>
      )}

      {/* PDF OPTIONS MODAL */}
      {pdfModal && (
        <PdfOptionsModal title={pdfModal.title} baseUrl={pdfModal.url} onClose={() => setPdfModal(null)} />
      )}

      {/* Back to Dashboard */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <a href="/dashboard" style={{ display: 'inline-block', padding: '12px 28px', background: '#0f3460', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

const labelFor = (cat) => {
  const labels = {
    monthly: 'Monthly Savings', extra: 'Extra Savings', penalty: 'Penalty',
    donation: 'Donation', misc: 'Miscellaneous', shares: 'Shares', membership: 'Membership'
  };
  return labels[cat] || cat;
};

const Btn = ({ children, onClick, color, type = 'button' }) => (
  <button type={type} onClick={onClick} style={{ padding: '10px 18px', background: color, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>{children}</button>
);

const btnMini = (bg) => ({ padding: '8px 14px', background: bg, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' });

const Card = ({ title, value, color, bg, icon }) => (
  <div style={{ background: bg, padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '11px', color, fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '17px', fontWeight: '700', color }}>UGX {Number(value || 0).toLocaleString()}</div>
    </div>
    <span style={{ fontSize: '20px' }}>{icon}</span>
  </div>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>{title}</h2>
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

const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const labelSm = { display: 'block', fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' };
const inputSm = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' };
const td = { padding: '12px' };