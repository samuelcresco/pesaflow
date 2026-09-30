import { useEffect, useState } from 'react';

export default function BusinessPage() {
  const [businesses, setBusinesses] = useState([]);
  const [clubCapital, setClubCapital] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capital: '',
    amount: '',
    profitAmount: '',
    lossAmount: '',
    businessId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [businessRes, capitalRes] = await Promise.all([
        fetch('http://localhost:5000/api/business'),
        fetch('http://localhost:5000/api/club-capital')
      ]);
      const businessData = await businessRes.json();
      const capitalData = await capitalRes.json();
      setBusinesses(businessData);
      setClubCapital(capitalData.balance || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = (type, businessId = null) => {
    setModalType(type);
    setShowModal(true);
    setFormData({
      name: '',
      description: '',
      capital: '',
      amount: '',
      profitAmount: '',
      lossAmount: '',
      businessId: businessId || ''
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
        case 'create':
          endpoint = 'http://localhost:5000/api/business';
          payload = {
            name: formData.name,
            description: formData.description,
            capital: parseFloat(formData.capital)
          };
          break;
        case 'profit':
          endpoint = `http://localhost:5000/api/business/${formData.businessId}/profit`;
          payload = {
            amount: parseFloat(formData.profitAmount),
            description: formData.description
          };
          break;
        case 'loss':
          endpoint = `http://localhost:5000/api/business/${formData.businessId}/loss`;
          payload = {
            amount: parseFloat(formData.lossAmount),
            description: formData.description
          };
          break;
        case 'close':
          endpoint = `http://localhost:5000/api/business/${formData.businessId}/close`;
          payload = {};
          break;
        case 'dividends':
          endpoint = `http://localhost:5000/api/business/${formData.businessId}/dividends`;
          payload = {};
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
        alert('Operation successful!');
        setShowModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Operation failed');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#1a1a2e' }}>📈 Business Management</h1>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#dbeafe', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#1e40af' }}>Club Capital</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e3a8a' }}>UGX {clubCapital.toLocaleString()}</div>
        </div>
        <div style={{ background: '#d1fae5', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#065f46' }}>Active Businesses</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#047857' }}>{businesses.filter(b => b.status === 'active').length}</div>
        </div>
        <div style={{ background: '#fee2e2', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#991b1b' }}>Total Profit</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#b91c1c' }}>UGX {businesses.reduce((sum, b) => sum + b.totalProfit, 0).toLocaleString()}</div>
        </div>
        <div style={{ background: '#fef3c7', padding: '18px 20px', borderRadius: '12px' }}>
          <div style={{ fontSize: '14px', color: '#92400e' }}>Total Capital</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#b45309' }}>UGX {businesses.reduce((sum, b) => sum + b.capital, 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button onClick={() => handleModalOpen('create')} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ New Business</button>
        <button onClick={() => handleModalOpen('dividends')} style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>💰 Distribute Dividends</button>
      </div>

      {/* Business List */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>All Businesses</h2>
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Capital</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Profit</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Loss</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((business, idx) => (
              <tr key={business._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                <td style={{ padding: '12px 16px' }}>{business.name}</td>
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>UGX {business.capital.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', color: '#16a34a' }}>UGX {business.totalProfit.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', color: '#dc2626' }}>UGX {business.totalLoss.toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: business.status === 'active' ? '#dcfce7' : '#fee2e2', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                    {business.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {business.status === 'active' && (
                      <>
                        <button onClick={() => handleModalOpen('profit', business._id)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>+ Profit</button>
                        <button onClick={() => handleModalOpen('loss', business._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>+ Loss</button>
                        <button onClick={() => handleModalOpen('close', business._id)} style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                      </>
                    )}
                    <button onClick={() => handleModalOpen('dividends', business._id)} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Dividends</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>
              {modalType === 'create' && 'Create New Business'}
              {modalType === 'profit' && 'Add Profit'}
              {modalType === 'loss' && 'Record Loss'}
              {modalType === 'close' && 'Close Business'}
              {modalType === 'dividends' && 'Distribute Dividends'}
            </h2>
            <form onSubmit={handleSubmit}>
              {modalType === 'create' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Business Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Capital (UGX)</label>
                    <input type="number" name="capital" value={formData.capital} onChange={handleInputChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Description</label>
                    <input type="text" name="description" value={formData.description} onChange={handleInputChange} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </>
              )}

              {(modalType === 'profit' || modalType === 'loss') && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Amount (UGX)</label>
                    <input type="number" name={modalType === 'profit' ? 'profitAmount' : 'lossAmount'} value={modalType === 'profit' ? formData.profitAmount : formData.lossAmount} onChange={handleInputChange} required min="1" step="0.01" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Description</label>
                    <input type="text" name="description" value={formData.description} onChange={handleInputChange} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  </div>
                </>
              )}

              {modalType === 'dividends' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Select Business</label>
                  <select name="businessId" value={formData.businessId} onChange={handleInputChange} required style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                    <option value="">Select a business with profit</option>
                    {businesses.filter(b => b.totalProfit > 0).map(b => (
                      <option key={b._id} value={b._id}>{b.name} (Profit: UGX {b.totalProfit.toLocaleString()})</option>
                    ))}
                  </select>
                  <small style={{ color: '#6b7280' }}>Dividends will be distributed to all members based on share ownership</small>
                </div>
              )}

              {modalType === 'close' && (
                <p style={{ color: '#b91c1c' }}>Are you sure you want to close this business? Capital will be returned to Club Capital.</p>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="submit" style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Confirm</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 24px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}