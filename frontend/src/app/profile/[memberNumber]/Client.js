'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function MemberProfile() {
  const params = useParams();
  const router = useRouter();
  const memberNumber = params.memberNumber;

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [groupSavings, setGroupSavings] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanType, setLoanType] = useState('emergency');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanMessage, setLoanMessage] = useState('');
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [memberLoans, setMemberLoans] = useState([]);
  const [loanLimit, setLoanLimit] = useState(0);
  const [allLoans, setAllLoans] = useState([]);
  const [showAllLoans, setShowAllLoans] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } else {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        const memberRes = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/members/${memberNumber}`);
        setMember(memberRes.data);

        try {
          const savingsRes = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/savings/member/${memberNumber}`);
          setTransactions(savingsRes.data.savings || []);
          setTotalSavings(savingsRes.data.totalSavings || 0);
        } catch (e) {}

        try {
          const groupRes = await axios.get('https://pesaflow-api-jpll.onrender.com/api/savings/summary');
          setGroupSavings(groupRes.data);
        } catch (e) {}

        try {
          const loansRes = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/loans/member/${memberNumber}`);
          setMemberLoans(loansRes.data.loans || []);
          setLoanLimit(loansRes.data.loanLimit || 0);
        } catch (e) {}

        if (parsedUser.role === 'admin') {
          try {
            const allLoansRes = await axios.get('https://pesaflow-api-jpll.onrender.com/api/loans/all');
            setAllLoans(allLoansRes.data || []);
          } catch (e) {}
        }

        setLoading(false);
      } catch (err) {
        setError('Failed to load member data.');
        setLoading(false);
      }
    };

    if (memberNumber) {
      fetchData();
    }
  }, [memberNumber, router]);

  const handleLoanApply = async (e) => {
    e.preventDefault();
    setLoanMessage('');
    if (!loanAmount || !loanPurpose) {
      setLoanMessage('Please fill in all fields.');
      return;
    }
    try {
      const response = await axios.post('https://pesaflow-api-jpll.onrender.com/api/loans/apply', {
        memberNumber: memberNumber,
        loanType: loanType,
        amount: Number(loanAmount),
        purpose: loanPurpose
      });
      setLoanMessage('✅ ' + response.data.message);
      setLoanAmount('');
      setLoanPurpose('');
      setShowLoanForm(false);
      const loansRes = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/loans/member/${memberNumber}`);
      setMemberLoans(loansRes.data.loans || []);
      setLoanLimit(loansRes.data.loanLimit || 0);
    } catch (err) {
      setLoanMessage('❌ ' + (err.response?.data?.error || 'Failed to apply.'));
    }
  };

  const printReport = () => {
    window.print();
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>{error}</div>;
  if (!member) return <div style={{ padding: '40px', textAlign: 'center' }}>Member not found</div>;

  const shareTypes = ['ordinary', 'silver', 'golden', 'platinum'];
  const shareLabels = { ordinary: 'Ordinary', silver: 'Silver', golden: 'Golden', platinum: 'Platinum' };
  const sharePrices = { ordinary: 100000, silver: 250000, golden: 500000, platinum: 1000000 };
  const shareMax = { ordinary: 15, silver: 10, golden: 5, platinum: 3 };

  let runningBalance = 0;
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const isAdmin = user?.role === 'admin';

  const getLoanTypeLabel = (type) => {
    const labels = {
      'Emergency Loan': 'Emergency',
      'Business Loan': 'Business',
      'School Fees Loan': 'School Fees'
    };
    return labels[type] || type;
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
        <h2 style={{ color: '#0f3460' }}>Member Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={printReport} style={{
            background: '#dc3545',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
            📄 Download PDF
          </button>
          <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back</a>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px' }}>
        <div>
          {member.photo ? (
            <img src={member.photo} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
              👤
            </div>
          )}
        </div>
        <div>
          <h3 style={{ margin: 0 }}>{member.fname || member.firstName} {member.lname || member.lastName}</h3>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Member Number:</strong> {member.memberNumber}</p>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Status:</strong> {member.status || 'Active'}</p>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Joined:</strong> {member.dateJoined ? new Date(member.dateJoined).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderBottom: '1px solid #ddd', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('profile')} style={{ padding: '10px 20px', background: activeTab === 'profile' ? '#0f3460' : 'transparent', color: activeTab === 'profile' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>My Profile</button>
        <button onClick={() => setActiveTab('savings')} style={{ padding: '10px 20px', background: activeTab === 'savings' ? '#0f3460' : 'transparent', color: activeTab === 'savings' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>My Savings</button>
        <button onClick={() => setActiveTab('groupsavings')} style={{ padding: '10px 20px', background: activeTab === 'groupsavings' ? '#0f3460' : 'transparent', color: activeTab === 'groupsavings' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>Group Savings</button>
        <button onClick={() => setActiveTab('loans')} style={{ padding: '10px 20px', background: activeTab === 'loans' ? '#0f3460' : 'transparent', color: activeTab === 'loans' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>Loans</button>
        <button onClick={() => setActiveTab('reports')} style={{ padding: '10px 20px', background: activeTab === 'reports' ? '#0f3460' : 'transparent', color: activeTab === 'reports' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>Reports</button>
        {isAdmin && (
          <button onClick={() => setActiveTab('adminloans')} style={{ padding: '10px 20px', background: activeTab === 'adminloans' ? '#0f3460' : 'transparent', color: activeTab === 'adminloans' ? 'white' : '#333', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>All Loans</button>
        )}
      </div>

      {activeTab === 'profile' && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Personal Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><strong>Email:</strong> {member.email || 'Not provided'}</div>
            <div><strong>Phone:</strong> {member.phoneNumber || member.phone || 'Not provided'}</div>
            <div><strong>Address:</strong> {member.address || 'Not provided'}</div>
            <div><strong>Occupation:</strong> {member.occupation || 'Not provided'}</div>
            <div><strong>Date of Birth:</strong> {member.dateOfBirth || 'Not provided'}</div>
            <div><strong>ID Number:</strong> {member.idNumber || 'Not provided'}</div>
          </div>

          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>My Shares</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
            {shareTypes.map(type => (
              <div key={type} style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <h4>{shareLabels[type]}</h4>
                <p><strong>Shares:</strong> {member.shares?.[type]?.count || 0} / {shareMax[type]}</p>
                <p><strong>Amount:</strong> UGX {sharePrices[type].toLocaleString()}</p>
                <p><strong>Value:</strong> UGX {((member.shares?.[type]?.count || 0) * sharePrices[type]).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#0f3460', color: 'white', padding: '15px', borderRadius: '6px', marginTop: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><strong>Total Shares:</strong> {member.totalShares || 0} / 15</div>
              <div><strong>Total Value:</strong> UGX {(member.totalValue || 0).toLocaleString()}</div>
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>Next of Kin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div><strong>Name:</strong> {member.nextOfKinName || 'Not provided'}</div>
            <div><strong>Phone:</strong> {member.nextOfKinPhone || 'Not provided'}</div>
            <div><strong>Relationship:</strong> {member.nextOfKinRelationship || 'Not provided'}</div>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ background: '#0f3460', color: 'white', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
            <h3 style={{ margin: 0 }}>Total Savings</h3>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0' }}>UGX {totalSavings.toLocaleString()}</p>
          </div>

          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>Savings History</h3>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No savings history yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f2f5', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Amount</th>
                  <th style={{ padding: '12px' }}>Description</th>
                  <th style={{ padding: '12px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((t, index) => {
                  runningBalance += t.amount;
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', color: t.amount < 0 ? 'red' : 'green' }}>
                        {t.amount < 0 ? '-' : ''} UGX {Math.abs(t.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }}>{t.description}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>UGX {runningBalance.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'groupsavings' && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Group Savings Overview</h3>
          {groupSavings && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <h4>Total Group Savings</h4>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f3460' }}>UGX {groupSavings.totalSavings?.toLocaleString() || 0}</p>
              </div>
              <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <h4>Total Members</h4>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f3460' }}>{groupSavings.totalMembers || 0}</p>
              </div>
              <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <h4>Total Income</h4>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f3460' }}>UGX {groupSavings.totalIncome?.toLocaleString() || 0}</p>
              </div>
            </div>
          )}

          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>Member Contributions</h3>
          {groupSavings?.memberSavings && groupSavings.memberSavings.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f2f5', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Member</th>
                  <th style={{ padding: '12px' }}>Savings</th>
                  <th style={{ padding: '12px' }}>Misc</th>
                  <th style={{ padding: '12px' }}>Penalties</th>
                  <th style={{ padding: '12px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {groupSavings.memberSavings.map((m) => (
                  <tr key={m.memberNumber} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{m.name}</td>
                    <td style={{ padding: '12px' }}>UGX {m.savings?.toLocaleString() || 0}</td>
                    <td style={{ padding: '12px' }}>UGX {m.misc?.toLocaleString() || 0}</td>
                    <td style={{ padding: '12px' }}>UGX {m.penalties?.toLocaleString() || 0}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>UGX {(m.savings + m.misc + m.penalties).toLocaleString() || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No group savings data available.</p>
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4>Loan Limit</h4>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460' }}>UGX {loanLimit.toLocaleString()}</p>
              <p style={{ fontSize: '12px', color: '#666' }}>70% of total savings</p>
            </div>
            <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4>Active Loans</h4>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460' }}>{memberLoans.filter(l => l.status === 'Approved' || l.status === 'Active').length}</p>
            </div>
            <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <h4>Total Borrowed</h4>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460' }}>UGX {memberLoans.reduce((sum, l) => sum + (l.amount || 0), 0).toLocaleString()}</p>
            </div>
          </div>

          <button onClick={() => setShowLoanForm(!showLoanForm)} style={{ width: '100%', padding: '12px', marginTop: '15px', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            {showLoanForm ? 'Cancel' : 'Apply for Loan'}
          </button>

          {showLoanForm && (
            <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginTop: '15px' }}>
              <h3>Apply for Loan</h3>
              <p style={{ fontSize: '14px', color: '#666' }}>
                <strong>Loan Limit:</strong> UGX {loanLimit.toLocaleString()} (70% of savings)<br />
                <strong>Emergency:</strong> 1 month | <strong>Business:</strong> 6 months (needs 3 Silver shares)<br />
                <strong>School Fees:</strong> 3 months (needs 3 Platinum shares)
              </p>
              <form onSubmit={handleLoanApply}>
                <div style={{ marginBottom: '15px' }}>
                  <label>Loan Type *</label>
                  <select value={loanType} onChange={(e) => setLoanType(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} required>
                    <option value="emergency">Emergency Loan (1 month)</option>
                    <option value="business">Business Loan (6 months)</option>
                    <option value="schoolfees">School Fees Loan (3 months)</option>
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label>Amount (UGX) *</label>
                  <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="Enter amount" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} required />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label>Purpose *</label>
                  <input type="text" value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} placeholder="e.g., School fees, Business, Emergency" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} required />
                </div>
                {loanMessage && <p style={{ color: loanMessage.includes('✅') ? 'green' : 'red' }}>{loanMessage}</p>}
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Submit Application</button>
              </form>
            </div>
          )}

          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: '20px' }}>My Loans</h3>
          {memberLoans.length === 0 ? (
            <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>No loans found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f3460', color: 'white', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Type</th>
                  <th style={{ padding: '10px' }}>Amount</th>
                  <th style={{ padding: '10px' }}>Interest</th>
                  <th style={{ padding: '10px' }}>Total</th>
                  <th style={{ padding: '10px' }}>Duration</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {memberLoans.map((loan, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{getLoanTypeLabel(loan.loanType)}</td>
                    <td style={{ padding: '10px' }}>UGX {loan.amount?.toLocaleString() || 0}</td>
                    <td style={{ padding: '10px' }}>{loan.interestRate || 0}%</td>
                    <td style={{ padding: '10px' }}>UGX {loan.totalRepayable?.toLocaleString() || 0}</td>
                    <td style={{ padding: '10px' }}>{loan.duration || 0}m</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: loan.status === 'Approved' || loan.status === 'Active' ? '#d4edda' :
                                  loan.status === 'Pending' ? '#fff3cd' :
                                  loan.status === 'Completed' ? '#cce5ff' :
                                  loan.status === 'Rejected' ? '#f8d7da' : '#e2e3e5',
                        color: loan.status === 'Approved' || loan.status === 'Active' ? '#155724' :
                               loan.status === 'Pending' ? '#856404' :
                               loan.status === 'Completed' ? '#004085' :
                               loan.status === 'Rejected' ? '#721c24' : '#383d41'
                      }}>
                        {loan.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>UGX {loan.remainingBalance?.toLocaleString() || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Generate Reports</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
            <button onClick={printReport} style={{ padding: '15px', background: '#e3f2fd', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
              <h4>📄 Savings Statement</h4>
              <p style={{ fontSize: '12px', color: '#666' }}>Download/Print savings history</p>
            </button>
            <button onClick={printReport} style={{ padding: '15px', background: '#e8f5e9', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
              <h4>📄 Loan Statement</h4>
              <p style={{ fontSize: '12px', color: '#666' }}>Download/Print loan history</p>
            </button>
            <button onClick={printReport} style={{ padding: '15px', background: '#fff3e0', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
              <h4>📄 Transaction Report</h4>
              <p style={{ fontSize: '12px', color: '#666' }}>Download/Print all transactions</p>
            </button>
            <button onClick={printReport} style={{ padding: '15px', background: '#fce4ec', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
              <h4>📄 Shares Report</h4>
              <p style={{ fontSize: '12px', color: '#666' }}>Download/Print shares summary</p>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'adminloans' && isAdmin && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>All Loans</h3>
          {allLoans.length === 0 ? (
            <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>No loans found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f3460', color: 'white', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Member</th>
                  <th style={{ padding: '10px' }}>Type</th>
                  <th style={{ padding: '10px' }}>Amount</th>
                  <th style={{ padding: '10px' }}>Total</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {allLoans.map((loan, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{loan.memberName || loan.memberNumber}</td>
                    <td style={{ padding: '10px' }}>{getLoanTypeLabel(loan.loanType)}</td>
                    <td style={{ padding: '10px' }}>UGX {loan.amount?.toLocaleString() || 0}</td>
                    <td style={{ padding: '10px' }}>UGX {loan.totalRepayable?.toLocaleString() || 0}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: loan.status === 'Approved' || loan.status === 'Active' ? '#d4edda' :
                                  loan.status === 'Pending' ? '#fff3cd' :
                                  loan.status === 'Completed' ? '#cce5ff' :
                                  loan.status === 'Rejected' ? '#f8d7da' : '#e2e3e5',
                        color: loan.status === 'Approved' || loan.status === 'Active' ? '#155724' :
                               loan.status === 'Pending' ? '#856404' :
                               loan.status === 'Completed' ? '#004085' :
                               loan.status === 'Rejected' ? '#721c24' : '#383d41'
                      }}>
                        {loan.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>UGX {loan.remainingBalance?.toLocaleString() || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}