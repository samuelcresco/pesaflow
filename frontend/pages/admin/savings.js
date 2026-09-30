import { useEffect, useState } from 'react';

export default function SavingsPage() {
  const [members, setMembers] = useState([]);
  const [clubCapital, setClubCapital] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    description: '',
    shareType: 'golden',
    quantity: '',
    pricePerShare: '',
    name: '',
    purchasePrice: '',
    salePrice: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [membersRes, capitalRes, settingsRes] = await Promise.all([
        fetch('http://localhost:5000/api/savings/members'),
        fetch('http://localhost:5000/api/club-capital'),
        fetch('http://localhost:5000/api/settings')
      ]);

      const membersData = await membersRes.json();
      const capitalData = await capitalRes.json();
      const settingsData = await settingsRes.json();

      setMembers(membersData);
      setClubCapital(capitalData.balance || 0);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = (type) => {
    setModalType(type);
    setShowModal(true);
    setFormData({
      memberId: '',
      amount: '',
      description: '',
      shareType: 'golden',
      quantity: '',
      pricePerShare: '',
      name: '',
      purchasePrice: '',
      salePrice: ''
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let endpoint = '';
      let payload = {};

      switch (modalType) {
        case 'monthly':
          endpoint = 'http://localhost:5000/api/savings/monthly';
          payload = {};
          break;
        case 'extra':
          endpoint = 'http://localhost:5000/api/savings/extra';
          payload = {
            memberId: formData.memberId,
            amount: parseFloat(formData.amount),
            description: formData.description
          };
          break;
        case 'penalty':
          endpoint = 'http://localhost:5000/api/savings/penalty';
          payload = {
            memberId: formData.memberId,
            amount: parseFloat(formData.amount),
            description: formData.description
          };
          break;
        case 'shares':
          endpoint = 'http://localhost:5000/api/savings/shares';
          payload = {
            memberId: formData.memberId,
            shareType: formData.shareType,
            quantity: parseInt(formData.quantity),
            pricePerShare: parseFloat(formData.pricePerShare)
          };
          break;
        case 'membership':
          endpoint = 'http://localhost:5000/api/savings/membership-fee';
          payload = {
            memberId: formData.memberId,
            amount: parseFloat(formData.amount)
          };
          break;
        case 'donation':
          endpoint = 'http://localhost:5000/api/savings/donation';
          payload = {
            amount: parseFloat(formData.amount),
            description: formData.description
          };
          break;
        case 'miscellaneous':
          endpoint = 'http://localhost:5000/api/savings/miscellaneous';
          payload = {
            amount: parseFloat(formData.amount),
            description: formData.description
          };
          break;
        case 'investment':
          endpoint = 'http://localhost:5000/api/savings/investment';
          payload = {
            name: formData.name,
            type: 'land',
            purchasePrice: parseFloat(formData.purchasePrice),
            description: formData.description
          };
          break;
        default:
          return;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Transaction successful!');
        setShowModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Transaction failed');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  const totalSavings = members.reduce((sum, m) => sum + (m.savavings || 0), 0);
  const totalExtra = members.reduce((sum, m) => sum + (m.extraSavings || 0), 0);
  const totalPenalties = members.reduce((sum, m) => sum + (m.penalties || 0), 0);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#1a1a2e' }}>💰 Savings & Income</h1>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button onClick={() => handleModalOpen('monthly')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Savings</button>
        <button onClick={() => handleModalOpen('extra')} style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Extra Savings</button>
        <button onClick={() => handleModalOpen('penalty')} style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Penalty</button>
        <button onClick={() => handleModalOpen('shares')} style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Buy Shares</button>
        <button onClick={() => handleModalOpen('membership')} style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Set Membership Fee</button>
        <button onClick={() => handleModalOpen('donation')} style={{ padding: '10px 20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Donation</button>
        <button onClick={() => handleModalOpen('miscellaneous')} style={{ padding: '10px 20px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Miscellaneous</button>
        <button onClick={() => handleModalOpen('investment')} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Buy Land/Asset</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#1e40af' }}>Total Savings</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e3a8a' }}>UGX {totalSavings.toLocaleString()}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#831843' }}>Extra Savings</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#9d174d' }}>UGX {totalExtra.toLocaleString()}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#991b1b' }}>Penalties</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#b91c1c' }}>UGX {totalPenalties.toLocaleString()}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#065f46' }}>Club Capital</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#047857' }}>UGX {clubCapital.toLocaleString()}</div>
        </div>
      </div>

      {/* Member Savings Table */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#1a1a2e' }}>Member Savings</h2>
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Member</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Savings</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Extra Savings</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Penalties</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Membership</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#334155' }}>Shares Value</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#334155' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, idx) => {
              const shareValue = (member.shares?.platinum || 0) * 1000 +
                                 (member.shares?.golden || 0) * 500 +
                                 (member.shares?.silver || 0) * 200 +
                                 (member.shares?.bronze || 0) * 100;
              return (
                <tr key={member._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                  <td style={{ padding: '12px 16px' }}>{member.name}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '500' }}>UGX {member.savings?.toLocaleString() || 0}</td>
                  <td style={{ padding: '12px 16px' }}>UGX {member.extraSavings?.toLocaleString() || 0}</td>
                  <td style={{ padding: '12px 16px' }}>UGX {member.penalties?.toLocaleString() || 0}</td>
                  <td style={{ padding: '12px 16px' }}>UGX {member.membershipFeePaid?.toLocaleString() || 0}</td>
                  <td style={{ padding: '12px 16px' }}>UGX {shareValue.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button onClick={() => window.open(`http://localhost:5000/api/savings/member/${member._id}/transactions`, '_blank')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>View Transactions</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>
              {modalType === 'monthly' && 'Add Monthly Savings'}
              {modalType === 'extra' && 'Add Extra Savings'}
              {modalType === 'penalty' && 'Add Penalty'}
              {modalType === 'shares' && 'Buy Shares'}
              {modalType === 'membership' && 'Set Membership Fee'}
              {modalType === 'donation' && 'Add Donation'}
              {modalType === 'miscellaneous' && 'Add Miscellaneous Income'}
              {modalType === 'investment' && 'Purchase Land/Asset'}
            </h2>
            <form onSubmit={handleSubmit}>
              {(modalType === 'extra' || modalType === 'penalty' || modalType === 'shares' || modalType === 'membership') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Member</label>
                  <select name="memberId" value={formData.memberId} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="">Select a member</option>
                    {members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              {(modalType === 'extra' || modalType === 'penalty' || modalType === 'membership' || modalType === 'donation' || modalType === 'miscellaneous') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Amount (UGX)</label>
                  <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
              )}

              {modalType === 'shares' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Share Type</label>
                    <select name="shareType" value={formData.shareType} onChange={handleInputChange} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                      <option value="golden">Golden</option>
                      <option value="platinum">Platinum</option>
                      <option value="silver">Silver</option>
                      <option value="bronze">Bronze</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Quantity</label>
                    <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required min="1" step="1" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Price Per Share (UGX)</label>
                    <input type="number" name="pricePerShare" value={formData.pricePerShare} onChange={handleInputChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </>
              )}

              {modalType === 'investment' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Asset Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Purchase Price (UGX)</label>
                    <input type="number" name="purchasePrice" value={formData.purchasePrice} onChange={handleInputChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </>
              )}

              {(modalType === 'extra' || modalType === 'penalty' || modalType === 'donation' || modalType === 'miscellaneous' || modalType === 'investment') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Description</label>
                  <input type="text" name="description" value={formData.description} onChange={handleInputChange} placeholder="Optional description" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
