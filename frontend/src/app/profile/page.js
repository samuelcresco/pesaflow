'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function MyProfile() {
  const router = useRouter();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanDuration, setLoanDuration] = useState(6);
  const [loanError, setLoanError] = useState('');
  const [loanSuccess, setLoanSuccess] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const fetchMember = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/members/${parsedUser.memberNumber}`);
        setMember(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load profile.');
        setLoading(false);
      }
    };

    fetchMember();
  }, [router]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!member) return <div style={{ padding: '40px', textAlign: 'center' }}>Member not found</div>;

  const totalShares = () => {
    return (
      (member.shares?.ordinary?.count || 0) +
      (member.shares?.silver?.count || 0) +
      (member.shares?.golden?.count || 0) +
      (member.shares?.platinum?.count || 0)
    );
  };

  const totalValue = () => {
    return (
      ((member.shares?.ordinary?.count || 0) * (member.shares?.ordinary?.amount || 0)) +
      ((member.shares?.silver?.count || 0) * (member.shares?.silver?.amount || 0)) +
      ((member.shares?.golden?.count || 0) * (member.shares?.golden?.amount || 0)) +
      ((member.shares?.platinum?.count || 0) * (member.shares?.platinum?.amount || 0))
    );
  };

  const totalSavings = () => {
    return totalValue();
  };

  const loanLimit = () => {
    return Math.floor(totalSavings() * 0.5);
  };

  const totalPenalties = () => {
    if (!member.penalties) return 0;
    return member.penalties.reduce((sum, p) => sum + p.amount, 0);
  };

  const unpaidPenalties = () => {
    if (!member.penalties) return 0;
    return member.penalties.filter(p => p.status === 'Unpaid').reduce((sum, p) => sum + p.amount, 0);
  };

  const handleLoanApply = async (e) => {
    e.preventDefault();
    setLoanError('');
    setLoanSuccess('');

    const amount = parseInt(loanAmount);
    if (!amount || amount <= 0) {
      setLoanError('Please enter a valid amount.');
      return;
    }

    if (amount > loanLimit()) {
      setLoanError(`Loan amount exceeds your limit of UGX ${loanLimit().toLocaleString()}.`);
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/loans/apply', {
        memberNumber: member.memberNumber,
        amount: amount,
        purpose: loanPurpose,
        duration: loanDuration,
        interestRate: 10
      });

      setLoanSuccess('Loan application submitted successfully!');
      setLoanAmount('');
      setLoanPurpose('');
      setLoanDuration(6);
      setShowLoanForm(false);
      
      const updated = await axios.get(`http://localhost:5000/api/members/${member.memberNumber}`);
      setMember(updated.data);
    } catch (err) {
      setLoanError(err.response?.data?.error || 'Failed to apply for loan.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ color: '#0f3460' }}>My Profile</h2>
        <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back to Dashboard</a>
      </div>

      {/* Profile Photo and Basic Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
        <div>
          {member.photo ? (
            <img src={member.photo} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
              👤
            </div>
          )}
        </div>
        <div>
          <h3 style={{ margin: 0 }}>{member.firstName || member.fname} {member.lastName || member.lname}</h3>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Member Number:</strong> {member.memberNumber}</p>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Status:</strong> {member.status || 'Active'}</p>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Joined:</strong> {member.dateJoined ? new Date(member.dateJoined).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>

      {/* Personal Information */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>Personal Information</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div><strong>Email:</strong> {member.email || 'Not provided'}</div>
        <div><strong>Phone:</strong> {member.phone || member.phoneNumber || 'Not provided'}</div>
        <div><strong>Address:</strong> {member.address || 'Not provided'}</div>
        <div><strong>Occupation:</strong> {member.occupation || 'Not provided'}</div>
        <div><strong>Date of Birth:</strong> {member.dateOfBirth || 'Not provided'}</div>
        <div><strong>ID Number:</strong> {member.idNumber || 'Not provided'}</div>
      </div>

      {/* Shares Section */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>My Shares</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>Each member can have a maximum of 15 shares total across all share types.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>Ordinary</h4>
          <p style={{ margin: '5px 0' }}><strong>Shares:</strong> {member.shares?.ordinary?.count || 0}</p>
          <p style={{ margin: '5px 0' }}><strong>Amount:</strong> UGX {member.shares?.ordinary?.amount?.toLocaleString() || 0}</p>
          <p style={{ margin: '5px 0', color: '#0f3460', fontWeight: 'bold' }}>
            Value: UGX {((member.shares?.ordinary?.count || 0) * (member.shares?.ordinary?.amount || 0)).toLocaleString()}
          </p>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>Silver</h4>
          <p style={{ margin: '5px 0' }}><strong>Shares:</strong> {member.shares?.silver?.count || 0}</p>
          <p style={{ margin: '5px 0' }}><strong>Amount:</strong> UGX {member.shares?.silver?.amount?.toLocaleString() || 0}</p>
          <p style={{ margin: '5px 0', color: '#0f3460', fontWeight: 'bold' }}>
            Value: UGX {((member.shares?.silver?.count || 0) * (member.shares?.silver?.amount || 0)).toLocaleString()}
          </p>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>Golden</h4>
          <p style={{ margin: '5px 0' }}><strong>Shares:</strong> {member.shares?.golden?.count || 0}</p>
          <p style={{ margin: '5px 0' }}><strong>Amount:</strong> UGX {member.shares?.golden?.amount?.toLocaleString() || 0}</p>
          <p style={{ margin: '5px 0', color: '#0f3460', fontWeight: 'bold' }}>
            Value: UGX {((member.shares?.golden?.count || 0) * (member.shares?.golden?.amount || 0)).toLocaleString()}
          </p>
        </div>

        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>Platinum</h4>
          <p style={{ margin: '5px 0' }}><strong>Shares:</strong> {member.shares?.platinum?.count || 0}</p>
          <p style={{ margin: '5px 0' }}><strong>Amount:</strong> UGX {member.shares?.platinum?.amount?.toLocaleString() || 0}</p>
          <p style={{ margin: '5px 0', color: '#0f3460', fontWeight: 'bold' }}>
            Value: UGX {((member.shares?.platinum?.count || 0) * (member.shares?.platinum?.amount || 0)).toLocaleString()}
          </p>
        </div>
      </div>

      <div style={{ background: '#0f3460', color: 'white', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div><strong>Total Shares:</strong> {totalShares()} / 15</div>
          <div><strong>Total Value:</strong> UGX {totalValue().toLocaleString()}</div>
        </div>
        {totalShares() > 15 && (
          <p style={{ color: '#ff6b6b', marginTop: '5px' }}>⚠️ Total shares exceed the maximum limit of 15!</p>
        )}
      </div>

      {/* Savings Section */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>My Savings</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>💰 Total Savings</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            UGX {totalSavings().toLocaleString()}
          </p>
        </div>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>📈 Total Deposits</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            UGX {totalSavings().toLocaleString()}
          </p>
        </div>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>📉 Total Withdrawals</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            UGX 0
          </p>
        </div>
      </div>

      <h4 style={{ marginTop: '20px' }}>Savings History</h4>
      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
        <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
          No savings history yet. Your deposits will appear here.
        </p>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button style={{ padding: '10px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          📥 Download Savings Statement
        </button>
      </div>

      {/* Loans Section */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>My Loans</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>🏦 Loan Limit</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            UGX {loanLimit().toLocaleString()}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>50% of total savings</p>
        </div>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>✅ Active Loans</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            {member.loans?.filter(l => l.status === 'Active' || l.status === 'Approved').length || 0}
          </p>
        </div>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>⏳ Pending Loans</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460', margin: '0' }}>
            {member.loans?.filter(l => l.status === 'Pending').length || 0}
          </p>
        </div>
      </div>

      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setShowLoanForm(!showLoanForm)} 
          style={{ padding: '10px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          {showLoanForm ? 'Cancel' : 'Apply for Loan'}
        </button>
      </div>

      {showLoanForm && (
        <div style={{ background: '#f0f2f5', padding: '20px', borderRadius: '8px', marginTop: '15px' }}>
          <h4>Apply for Loan</h4>
          <form onSubmit={handleLoanApply}>
            <div style={{ marginBottom: '15px' }}>
              <label>Amount (UGX) *</label>
              <input 
                type="number" 
                value={loanAmount} 
                onChange={(e) => setLoanAmount(e.target.value)} 
                placeholder="Enter amount" 
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} 
                required 
              />
              <p style={{ fontSize: '12px', color: '#666' }}>Max: UGX {loanLimit().toLocaleString()}</p>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Purpose *</label>
              <input 
                type="text" 
                value={loanPurpose} 
                onChange={(e) => setLoanPurpose(e.target.value)} 
                placeholder="e.g., School fees, Business" 
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} 
                required 
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Duration (months) *</label>
              <select 
                value={loanDuration} 
                onChange={(e) => setLoanDuration(e.target.value)} 
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
              >
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="18">18 months</option>
                <option value="24">24 months</option>
              </select>
            </div>
            {loanError && <p style={{ color: 'red' }}>{loanError}</p>}
            {loanSuccess && <p style={{ color: 'green' }}>{loanSuccess}</p>}
            <button type="submit" style={{ width: '100%', padding: '14px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Submit Application
            </button>
          </form>
        </div>
      )}

      <h4 style={{ marginTop: '20px' }}>Loan History</h4>
      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
        <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
          No loans yet. Apply for a loan above.
        </p>
      </div>

      {/* Penalties Section */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>⚠️ Penalties</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div style={{ background: '#fce4ec', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>💰 Total Penalties</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828', margin: '0' }}>
            UGX {totalPenalties().toLocaleString()}
          </p>
        </div>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>⏳ Unpaid</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100', margin: '0' }}>
            UGX {unpaidPenalties().toLocaleString()}
          </p>
        </div>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>✅ Paid</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32', margin: '0' }}>
            UGX {(totalPenalties() - unpaidPenalties()).toLocaleString()}
          </p>
        </div>
      </div>

      <h4 style={{ marginTop: '20px' }}>Penalty History</h4>
      <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
        {member.penalties && member.penalties.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: '10px' }}>Date</th>
                <th style={{ padding: '10px' }}>Type</th>
                <th style={{ padding: '10px' }}>Amount</th>
                <th style={{ padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {member.penalties.map((penalty, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{new Date(penalty.date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px' }}>{penalty.type}</td>
                  <td style={{ padding: '10px' }}>UGX {penalty.amount.toLocaleString()}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      background: penalty.status === 'Paid' ? '#d4edda' : '#f8d7da',
                      color: penalty.status === 'Paid' ? '#155724' : '#721c24'
                    }}>
                      {penalty.status || 'Unpaid'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666', textAlign: 'center', margin: '20px 0' }}>
            No penalties. You are in good standing! ✅
          </p>
        )}
      </div>

      {unpaidPenalties() > 0 && (
        <div style={{ marginTop: '10px' }}>
          <button style={{ padding: '10px 20px', background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            💳 Pay Outstanding Penalties
          </button>
        </div>
      )}

      {/* Reports Section */}
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>📊 Reports</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>Download your financial reports and statements.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
        
        {/* Savings Statement */}
        <div style={{ 
          background: '#e3f2fd', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          border: '1px solid #bbdefb',
          cursor: 'pointer'
        }}
        onClick={() => window.open('/api/reports/savings', '_blank')}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>💰 Savings</h4>
          <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>Download savings statement</p>
          <p style={{ fontSize: '12px', color: '#0f3460', marginTop: '10px' }}>📥 PDF</p>
        </div>

        {/* Loan Statement */}
        <div style={{ 
          background: '#e8f5e9', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          border: '1px solid #c8e6c9',
          cursor: 'pointer'
        }}
        onClick={() => window.open('/api/reports/loans', '_blank')}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>🏦 Loans</h4>
          <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>Download loan statement</p>
          <p style={{ fontSize: '12px', color: '#0f3460', marginTop: '10px' }}>📥 PDF</p>
        </div>

        {/* Transaction History */}
        <div style={{ 
          background: '#fff3e0', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          border: '1px solid #ffe0b2',
          cursor: 'pointer'
        }}
        onClick={() => window.open('/api/reports/transactions', '_blank')}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>📊 Transactions</h4>
          <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>Download transaction history</p>
          <p style={{ fontSize: '12px', color: '#0f3460', marginTop: '10px' }}>📥 PDF</p>
        </div>

        {/* Full Profile Report */}
        <div style={{ 
          background: '#fce4ec', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          border: '1px solid #f8bbd0',
          cursor: 'pointer'
        }}
        onClick={() => window.open('/api/reports/profile', '_blank')}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0f3460' }}>📋 Full Profile</h4>
          <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>Download complete profile report</p>
          <p style={{ fontSize: '12px', color: '#0f3460', marginTop: '10px' }}>📥 PDF</p>
        </div>

      </div>

      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <p style={{ color: '#999', fontSize: '12px' }}>Click any report above to download as PDF</p>
      </div>

    </div>
  );
}
