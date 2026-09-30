import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [clubSummary, setClubSummary] = useState(null);
  const [loanReport, setLoanReport] = useState(null);
  const [dividendReport, setDividendReport] = useState(null);
  const [businessReport, setBusinessReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('club');

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      const [clubRes, loanRes, dividendRes, businessRes] = await Promise.all([
        fetch('http://localhost:5000/api/reports/club-summary'),
        fetch('http://localhost:5000/api/reports/loans'),
        fetch('http://localhost:5000/api/reports/dividends'),
        fetch('http://localhost:5000/api/reports/business')
      ]);

      const clubData = await clubRes.json();
      const loanData = await loanRes.json();
      const dividendData = await dividendRes.json();
      const businessData = await businessRes.json();

      setClubSummary(clubData.summary);
      setLoanReport(loanData.summary);
      setDividendReport(dividendData.summary);
      setBusinessReport(businessData.summary);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading reports...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '24px', color: '#1a1a2e' }}>📊 Reports</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        {['club', 'loans', 'dividends', 'business'].map(tab => (
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
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Club Summary */}
      {activeTab === 'club' && clubSummary && (
        <div>
          <h2>Club Financial Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#dbeafe', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#1e40af' }}>Total Members</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a8a' }}>{clubSummary.totalMembers}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#065f46' }}>Total Savings</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#047857' }}>UGX {clubSummary.totalSavings?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fef3c7', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#92400e' }}>Club Capital</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309' }}>UGX {clubSummary.clubCapital?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fce7f3', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#831843' }}>Total Loans</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#9d174d' }}>{clubSummary.totalLoans || 0}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Pending Loans</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#b45309' }}>{clubSummary.pendingLoans || 0}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Active Loans</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>{clubSummary.activeLoans || 0}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Closed Loans</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#475569' }}>{clubSummary.closedLoans || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Report */}
      {activeTab === 'loans' && loanReport && (
        <div>
          <h2>Loan Portfolio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#dbeafe', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#1e40af' }}>Total Loans</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a8a' }}>{loanReport.total}</div>
            </div>
            <div style={{ background: '#fef3c7', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#92400e' }}>Pending</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309' }}>{loanReport.pending}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#065f46' }}>Active</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#047857' }}>{loanReport.active}</div>
            </div>
            <div style={{ background: '#fee2e2', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#991b1b' }}>Defaulted</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b91c1c' }}>{loanReport.defaulted}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Total Amount</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>UGX {loanReport.totalAmount?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Total Interest</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>UGX {loanReport.totalInterest?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>Total Repayable</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#7c3aed' }}>UGX {loanReport.totalRepayable?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dividend Report */}
      {activeTab === 'dividends' && dividendReport && (
        <div>
          <h2>Dividend Report</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: '#dbeafe', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#1e40af' }}>Total Dividend Rounds</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a8a' }}>{dividendReport.totalDividendRounds || 0}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#065f46' }}>Total Distributed</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#047857' }}>UGX {dividendReport.totalDistributed?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fef3c7', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#92400e' }}>Members Benefited</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309' }}>{dividendReport.totalMembersBenefited || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Business Report */}
      {activeTab === 'business' && businessReport && (
        <div>
          <h2>Business Report</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ background: '#dbeafe', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#1e40af' }}>Total Businesses</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a8a' }}>{businessReport.totalBusinesses || 0}</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#065f46' }}>Active</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#047857' }}>{businessReport.activeBusinesses || 0}</div>
            </div>
            <div style={{ background: '#fef3c7', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#92400e' }}>Total Profit</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309' }}>UGX {businessReport.totalProfit?.toLocaleString() || 0}</div>
            </div>
            <div style={{ background: '#fee2e2', padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '14px', color: '#991b1b' }}>Total Loss</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#b91c1c' }}>UGX {businessReport.totalLoss?.toLocaleString() || 0}</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: '600' }}>Net Profit</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: (businessReport.netProfit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
              UGX {businessReport.netProfit?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}