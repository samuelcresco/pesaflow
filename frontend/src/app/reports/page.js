'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API } from '../api-client';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0f3460', '#2563eb', '#7c3aed', '#15803d', '#b45309', '#dc2626', '#0891b2', '#c9a227', '#ec4899', '#14b8a6'];

export default function ReportsPage() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchReport(tab); }, [tab]);

  const fetchReport = async (type) => {
    setLoading(true);
    setData(null);
    setError('');
    try {
      const endpoint = {
        overview: 'dashboard/overview',
        savings: 'dashboard/savings',
        loans: 'dashboard/loans',
        members: 'dashboard/members',
        shares: 'dashboard/shares',
        business: 'dashboard/business',
        expenses: 'dashboard/expenses',
        trial: 'trial-balance',
        pl: 'profit-loss',
        bs: 'balance-sheet',
        journal: 'journal-entries'
      }[type];

      const res = await apiFetch(`/api/reports/${endpoint}`);
      const d = await res.json();
      if (!res.ok) setError(d.error || 'Failed to load');
      else setData(d);
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'savings', label: '💰 Savings' },
    { id: 'loans', label: '🏦 Loans' },
    { id: 'members', label: '👥 Members' },
    { id: 'shares', label: '📈 Shares' },
    { id: 'business', label: '💼 Business' },
    { id: 'expenses', label: '💸 Expenses' },
    { id: 'trial', label: '📋 Trial Balance' },
    { id: 'pl', label: '📈 P&L' },
    { id: 'bs', label: '⚖️ Balance Sheet' },
    { id: 'journal', label: '📓 Journal' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1 style={{ margin: 0 }}>📊 Financial Reports & Analytics</h1>
      <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Complete club health, all modules, and accounting reports in one place.</p>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e5e7eb', marginTop: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 14px', background: 'transparent', border: 'none',
              borderBottom: tab === t.id ? '3px solid #2563eb' : '3px solid transparent',
              color: tab === t.id ? '#1e293b' : '#64748b',
              fontWeight: tab === t.id ? '600' : '500',
              cursor: 'pointer', marginBottom: '-2px', fontSize: '13px'
            }}
          >{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading report...</div>}
      {error && <div style={{ padding: '14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>❌ {error}</div>}

      {!loading && data && tab === 'overview' && <Overview data={data} />}
      {!loading && data && tab === 'savings' && <Savings data={data} />}
      {!loading && data && tab === 'loans' && <Loans data={data} />}
      {!loading && data && tab === 'members' && <Members data={data} />}
      {!loading && data && tab === 'shares' && <Shares data={data} />}
      {!loading && data && tab === 'business' && <Business data={data} />}
      {!loading && data && tab === 'expenses' && <Expenses data={data} />}
      {!loading && data && tab === 'trial' && <TrialBalance data={data} />}
      {!loading && data && tab === 'pl' && <ProfitLoss data={data} />}
      {!loading && data && tab === 'bs' && <BalanceSheet data={data} />}
      {!loading && data && tab === 'journal' && <JournalList data={data} />}
    </div>
  );
}

// ==================== OVERVIEW ====================
function Overview({ data }) {
  const o = data.overview || {};
  const trend = data.savingsTrend || [];
  const loans = data.loansTrend || [];
  const growth = data.memberGrowth || [];
  const status = data.loansByStatus || {};
  const savings = data.savingsByCategory || [];
  const expenses = data.expensesByCategory || [];
  const topSavers = data.topSavers || [];
  const businesses = data.businessPerformance || [];

  const statusPie = [
    { name: 'Pending', value: status.pending || 0 },
    { name: 'Approved', value: status.approved || 0 },
    { name: 'Disbursed', value: status.disbursed || 0 },
    { name: 'Active', value: status.active || 0 },
    { name: 'Closed', value: status.closed || 0 },
    { name: 'Rejected', value: status.rejected || 0 }
  ].filter(x => x.value > 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Club Capital" value={o.totalClubCapital} color="#0369a1" bg="#e0f2fe" icon="🏛️" />
        <StatCard label="Member Savings" value={o.totalMemberSavings} color="#15803d" bg="#dcfce7" icon="💰" />
        <StatCard label="Shares Value" value={o.totalSharesValue} color="#7c3aed" bg="#f3e8ff" icon="📊" />
        <StatCard label="Loans Outstanding" value={o.totalLoansOutstanding} color="#b45309" bg="#fef9e7" icon="🏦" />
        <StatCard label="Active Members" value={o.activeMembers} raw color="#0369a1" bg="#e0f2fe" icon="👥" />
        <StatCard label="Active Loans" value={o.totalActiveLoans} raw color="#7c3aed" bg="#f3e8ff" icon="📌" />
        <StatCard label="Profit Pool" value={o.profitPoolBalance} color="#0891b2" bg="#cffafe" icon="💰" />
        <StatCard label="Interest Fund" value={o.interestFundBalance} color="#15803d" bg="#dcfce7" icon="📈" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Savings Trend (12 months)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#15803d" strokeWidth={3} name="Savings" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Loans Trend (12 months)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={loans}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="disbursed" fill="#dc2626" name="Disbursed" />
              <Bar dataKey="repaid" fill="#15803d" name="Repaid" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Loans by Status">
          {statusPie.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Savings by Category">
          {savings.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={savings} dataKey="total" nameKey="category" outerRadius={80} label>
                  {savings.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Member Growth">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={3} name="New Members" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Top 10 Savers">
          <table style={tableStyle}>
            <thead><tr style={theadStyle}><th style={th}>#</th><th style={th}>Member</th><th style={thRight}>Savings</th></tr></thead>
            <tbody>
              {topSavers.map((m, i) => (
                <tr key={i} style={trStyle}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{m.name}<br /><small style={{ color: '#94a3b8' }}>{m.memberNumber}</small></td>
                  <td style={tdRight}>UGX {Number(m.savings).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard title="Expenses by Category">
          {expenses.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={expenses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" style={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" style={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
                <Bar dataKey="total" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Business Performance">
        {businesses.length === 0 ? <EmptyMsg msg="No businesses yet." /> : (
          <table style={tableStyle}>
            <thead>
              <tr style={theadStyle}>
                <th style={th}>Business</th>
                <th style={thRight}>Revenue</th>
                <th style={thRight}>Expenses</th>
                <th style={thRight}>Net Profit</th>
                <th style={thRight}>Balance</th>
                <th style={thRight}>Extracted</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map(b => (
                <tr key={b._id} style={trStyle}>
                  <td style={td}><strong>{b.name}</strong>{b.isSystem && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 8 }}>SYSTEM</span>}</td>
                  <td style={tdRight}>UGX {Number(b.revenue).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.expenses).toLocaleString()}</td>
                  <td style={{ ...tdRight, fontWeight: 700, color: b.netProfit >= 0 ? '#15803d' : '#dc2626' }}>UGX {Number(b.netProfit).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.currentBalance).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.totalProfitExtracted).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>
    </div>
  );
}

// ==================== SAVINGS ====================
function Savings({ data }) {
  const cats = data.byCategory || [];
  const months = data.byMonth || [];
  const top = data.topMembers || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/savings/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Savings Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Grand Total" value={data.grandTotal} color="#15803d" bg="#dcfce7" icon="💰" />
        <StatCard label="Total Transactions" value={data.totalTransactions} raw color="#0369a1" bg="#e0f2fe" icon="🧾" />
        <StatCard label="Categories" value={cats.length} raw color="#7c3aed" bg="#f3e8ff" icon="📊" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="By Category">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" style={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" style={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              <Bar dataKey="total" fill="#15803d" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={months}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Top 15 Savers">
        <table style={tableStyle}>
          <thead><tr style={theadStyle}><th style={th}>#</th><th style={th}>Member</th><th style={th}>Member No.</th><th style={thRight}>Total</th></tr></thead>
          <tbody>
            {top.map((m, i) => (
              <tr key={i} style={trStyle}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.memberNumber}</td>
                <td style={tdRight}>UGX {Number(m.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}

// ==================== LOANS ====================
function Loans({ data }) {
  const status = data.byStatus || [];
  const types = data.byType || [];
  const outstanding = data.outstandingLoans || [];
  const overdue = data.overdueList || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/loans/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Loans Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Total Loans" value={data.totalLoans} raw color="#0369a1" bg="#e0f2fe" icon="🏦" />
        <StatCard label="Total Disbursed" value={data.totalDisbursed} color="#b45309" bg="#fef9e7" icon="💸" />
        <StatCard label="Total Repaid" value={data.totalRepaid} color="#15803d" bg="#dcfce7" icon="✅" />
        <StatCard label="Outstanding" value={data.totalOutstanding} color="#dc2626" bg="#fee2e2" icon="📌" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="By Status">
          {status.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={status} dataKey="count" nameKey="status" outerRadius={80} label>
                  {status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="By Loan Type">
          {types.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={types} dataKey="total" nameKey="type" outerRadius={80} label>
                  {types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Overdue Installments">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', fontWeight: '700', color: data.overdueCount > 0 ? '#dc2626' : '#15803d' }}>
              {data.overdueCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>installments overdue</div>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Outstanding Loans (Top 20)">
        {outstanding.length === 0 ? <EmptyMsg msg="No outstanding loans." /> : (
          <table style={tableStyle}>
            <thead><tr style={theadStyle}><th style={th}>Member</th><th style={th}>Type</th><th style={thRight}>Amount</th><th style={thRight}>Outstanding</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {outstanding.slice(0, 20).map((l, i) => (
                <tr key={i} style={trStyle}>
                  <td style={td}>{l.memberName}<br /><small style={{ color: '#94a3b8' }}>{l.memberNumber}</small></td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{l.loanType.replace('_', ' ')}</td>
                  <td style={tdRight}>UGX {Number(l.amount).toLocaleString()}</td>
                  <td style={{ ...tdRight, color: '#dc2626', fontWeight: 700 }}>UGX {Number(l.outstanding).toLocaleString()}</td>
                  <td style={td}><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>

      {overdue.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <ChartCard title={`Overdue Installments (${data.overdueCount})`}>
            <table style={tableStyle}>
              <thead><tr style={theadStyle}><th style={th}>Member</th><th style={th}>Installment #</th><th style={th}>Due Date</th><th style={thRight}>Amount</th></tr></thead>
              <tbody>
                {overdue.map((r, i) => (
                  <tr key={i} style={{ ...trStyle, background: '#fef2f2' }}>
                    <td style={td}>{r.memberName}</td>
                    <td style={td}>#{r.installmentNumber}</td>
                    <td style={td}>{new Date(r.dueDate).toLocaleDateString()}</td>
                    <td style={{ ...tdRight, color: '#dc2626', fontWeight: 600 }}>UGX {Number(r.amountDue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ==================== MEMBERS ====================
function Members({ data }) {
  const growth = data.byMonth || [];
  const shares = data.shareBreakdown || {};
  const list = data.membersList || [];

  const sharePie = [
    { name: 'Golden', value: shares.golden || 0 },
    { name: 'Platinum', value: shares.platinum || 0 },
    { name: 'Silver', value: shares.silver || 0 },
    { name: 'Bronze', value: shares.bronze || 0 }
  ].filter(x => x.value > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/members/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Members Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Total Members" value={data.total} raw color="#0369a1" bg="#e0f2fe" icon="👥" />
        <StatCard label="Active" value={data.active} raw color="#15803d" bg="#dcfce7" icon="✅" />
        <StatCard label="Inactive" value={data.inactive} raw color="#dc2626" bg="#fee2e2" icon="⛔" />
        <StatCard label="With Active Loan" value={data.withActiveLoan} raw color="#b45309" bg="#fef9e7" icon="🏦" />
        <StatCard label="Total Shares" value={data.totalShares} raw color="#7c3aed" bg="#f3e8ff" icon="📊" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Member Growth">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Share Distribution">
          {sharePie.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sharePie} dataKey="value" nameKey="name" outerRadius={90} label>
                  {sharePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="All Members">
        <table style={tableStyle}>
          <thead><tr style={theadStyle}><th style={th}>#</th><th style={th}>Name</th><th style={th}>Member No.</th><th style={th}>Contact</th><th style={thRight}>Savings</th><th style={thRight}>Shares</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {list.map((m, i) => (
              <tr key={i} style={trStyle}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.memberNumber}</td>
                <td style={td}>{m.contact}</td>
                <td style={tdRight}>UGX {Number(m.savings).toLocaleString()}</td>
                <td style={tdRight}>{m.shares}</td>
                <td style={td}>
                  <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: 11, background: m.active ? '#dcfce7' : '#fee2e2', color: m.active ? '#065f46' : '#991b1b', fontWeight: 600 }}>
                    {m.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}

// ==================== SHARES ====================
function Shares({ data }) {
  const totals = data.totals || {};
  const byMember = data.byMember || [];

  const chartData = [
    { type: 'Golden', qty: totals.golden?.qty || 0, value: totals.golden?.value || 0 },
    { type: 'Platinum', qty: totals.platinum?.qty || 0, value: totals.platinum?.value || 0 },
    { type: 'Silver', qty: totals.silver?.qty || 0, value: totals.silver?.value || 0 },
    { type: 'Bronze', qty: totals.bronze?.qty || 0, value: totals.bronze?.value || 0 }
  ].filter(x => x.qty > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/shares/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Shares Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Total Shares" value={data.grandTotalQty} raw color="#7c3aed" bg="#f3e8ff" icon="📊" />
        <StatCard label="Total Value" value={data.grandTotalValue} color="#15803d" bg="#dcfce7" icon="💰" />
        <StatCard label="Members Holding" value={byMember.filter(m => m.total > 0).length} raw color="#0369a1" bg="#e0f2fe" icon="👥" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Share Distribution">
          {chartData.length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} dataKey="qty" nameKey="type" outerRadius={90} label>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Value per Type">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
              <Bar dataKey="value" fill="#c9a227" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Shares by Member">
        <table style={tableStyle}>
          <thead>
            <tr style={theadStyle}>
              <th style={th}>Member</th>
              <th style={th}>Member No.</th>
              <th style={thRight}>Golden</th>
              <th style={thRight}>Platinum</th>
              <th style={thRight}>Silver</th>
              <th style={thRight}>Bronze</th>
              <th style={thRight}>Total Qty</th>
              <th style={thRight}>Value</th>
            </tr>
          </thead>
          <tbody>
            {byMember.map((m, i) => (
              <tr key={i} style={trStyle}>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.memberNumber}</td>
                <td style={tdRight}>{m.golden}</td>
                <td style={tdRight}>{m.platinum}</td>
                <td style={tdRight}>{m.silver}</td>
                <td style={tdRight}>{m.bronze}</td>
                <td style={{ ...tdRight, fontWeight: 700 }}>{m.total}</td>
                <td style={{ ...tdRight, fontWeight: 700, color: '#c9a227' }}>UGX {Number(m.value).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}

// ==================== BUSINESS ====================
function Business({ data }) {
  const list = data.byBusiness || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/business/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Business Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Total Businesses" value={data.totalBusinesses} raw color="#0369a1" bg="#e0f2fe" icon="💼" />
        <StatCard label="Total Revenue" value={data.totalRevenue} color="#15803d" bg="#dcfce7" icon="📈" />
        <StatCard label="Total Expenses" value={data.totalExpenses} color="#dc2626" bg="#fee2e2" icon="💸" />
        <StatCard label="Net Profit" value={data.totalRevenue - data.totalExpenses - data.totalLosses} color="#7c3aed" bg="#f3e8ff" icon="💰" />
      </div>

      <ChartCard title="Revenue vs Expenses per Business">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={list}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" style={{ fontSize: 11 }} />
            <YAxis style={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
            <Legend />
            <Bar dataKey="revenue" fill="#15803d" name="Revenue" />
            <Bar dataKey="expenses" fill="#dc2626" name="Expenses" />
            <Bar dataKey="losses" fill="#b45309" name="Losses" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ marginTop: '20px' }}>
        <ChartCard title="Business Details">
          <table style={tableStyle}>
            <thead>
              <tr style={theadStyle}>
                <th style={th}>Business</th>
                <th style={thRight}>Revenue</th>
                <th style={thRight}>Expenses</th>
                <th style={thRight}>Net Profit</th>
                <th style={thRight}>Capital In</th>
                <th style={thRight}>Extracted</th>
                <th style={thRight}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b._id} style={trStyle}>
                  <td style={td}><strong>{b.name}</strong>{b.isSystem && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 8 }}>SYSTEM</span>}</td>
                  <td style={tdRight}>UGX {Number(b.revenue).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.expenses).toLocaleString()}</td>
                  <td style={{ ...tdRight, fontWeight: 700, color: b.netProfit >= 0 ? '#15803d' : '#dc2626' }}>UGX {Number(b.netProfit).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.capitalIn).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.extracted).toLocaleString()}</td>
                  <td style={tdRight}>UGX {Number(b.currentBalance).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      </div>
    </div>
  );
}

// ==================== EXPENSES ====================
function Expenses({ data }) {
  const club = data.club || {};
  const business = data.business || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <a
          href={`${API}/api/reports/dashboard/expenses/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
        >📄 Download Expenses Report PDF</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="Club Expenses" value={club.total} color="#dc2626" bg="#fee2e2" icon="🏛️" />
        <StatCard label="Business Expenses" value={business.total} color="#b45309" bg="#fef9e7" icon="💼" />
        <StatCard label="Grand Total" value={data.grandTotal} color="#7c3aed" bg="#f3e8ff" icon="💸" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <ChartCard title="Club Expenses by Category">
          {(club.byCategory || []).length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={club.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" style={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" style={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
                <Bar dataKey="total" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Business Expenses by Category">
          {(business.byCategory || []).length === 0 ? <EmptyMsg /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={business.byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" style={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" style={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => `UGX ${Number(v).toLocaleString()}`} />
                <Bar dataKey="total" fill="#b45309" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Recent Club Expenses">
        {(club.recent || []).length === 0 ? <EmptyMsg /> : (
          <table style={tableStyle}>
            <thead><tr style={theadStyle}><th style={th}>Date</th><th style={th}>Description</th><th style={th}>Category</th><th style={thRight}>Amount</th></tr></thead>
            <tbody>
              {club.recent.map((e, i) => (
                <tr key={i} style={trStyle}>
                  <td style={td}>{new Date(e.date).toLocaleDateString()}</td>
                  <td style={td}>{e.description}</td>
                  <td style={{ ...td, textTransform: 'capitalize' }}>{(e.category || 'other').replace('_', ' ')}</td>
                  <td style={tdRight}>UGX {Number(e.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>
    </div>
  );
}

// ==================== TRIAL BALANCE ====================
function TrialBalance({ data }) {
  const accounts = data.accounts || [];
  const totalDebit = Number(data.totalDebit) || 0;
  const totalCredit = Number(data.totalCredit) || 0;

  return (
    <div>
      <p style={{ color: data.balanced ? '#15803d' : '#dc2626', fontWeight: '600' }}>
        {data.balanced ? '✅ Balanced' : '⚠️ NOT balanced'} — Debits: UGX {totalDebit.toLocaleString()} / Credits: UGX {totalCredit.toLocaleString()}
      </p>
      {accounts.length === 0 ? <EmptyMsg msg="No journal entries." /> : (
        <table style={tableStyle}>
          <thead><tr style={theadStyle}><th style={th}>Code</th><th style={th}>Account</th><th style={thRight}>Debit</th><th style={thRight}>Credit</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.code} style={trStyle}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.name}</td>
                <td style={tdRight}>{a.debit ? Number(a.debit).toLocaleString() : '-'}</td>
                <td style={tdRight}>{a.credit ? Number(a.credit).toLocaleString() : '-'}</td>
              </tr>
            ))}
            <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
              <td style={td} colSpan="2">Total</td>
              <td style={tdRight}>{totalDebit.toLocaleString()}</td>
              <td style={tdRight}>{totalCredit.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ==================== PROFIT & LOSS ====================
function ProfitLoss({ data }) {
  const businesses = data.businesses || [];
  const totals = data.totals || {};

  return (
    <div>
      {businesses.length === 0 ? <EmptyMsg msg="No businesses yet." /> : (
        <table style={tableStyle}>
          <thead><tr style={theadStyle}><th style={th}>Business</th><th style={thRight}>Revenue</th><th style={thRight}>Expenses</th><th style={thRight}>Losses</th><th style={thRight}>Net Profit</th></tr></thead>
          <tbody>
            {businesses.map(b => (
              <tr key={b.businessId} style={trStyle}>
                <td style={td}>{b.businessName || '—'}</td>
                <td style={tdRight}>{Number(b.revenue || 0).toLocaleString()}</td>
                <td style={tdRight}>{Number(b.expenses || 0).toLocaleString()}</td>
                <td style={tdRight}>{Number(b.losses || 0).toLocaleString()}</td>
                <td style={{ ...tdRight, fontWeight: '700', color: (b.netProfit || 0) >= 0 ? '#15803d' : '#dc2626' }}>{Number(b.netProfit || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
        <h3 style={{ marginTop: 0 }}>Club Totals</h3>
        <p>Total Revenue: <strong>UGX {Number(totals.totalRevenue || 0).toLocaleString()}</strong></p>
        <p>Total Expenses: <strong>UGX {Number(totals.totalExpenses || 0).toLocaleString()}</strong></p>
        <p>Total Losses: <strong>UGX {Number(totals.totalLosses || 0).toLocaleString()}</strong></p>
        <p>Club Expenses: <strong>UGX {Number(totals.totalClubExpenses || 0).toLocaleString()}</strong></p>
        <p style={{ fontSize: '18px' }}>
          Net Profit: <strong style={{ color: (totals.netProfit || 0) >= 0 ? '#15803d' : '#dc2626' }}>
            UGX {Number(totals.netProfit || 0).toLocaleString()}
          </strong>
        </p>
      </div>
    </div>
  );
}

// ==================== BALANCE SHEET ====================
function BalanceSheet({ data }) {
  const assets = data.assets || [];
  const liabilities = data.liabilities || [];
  const equity = data.equity || [];

  return (
    <div>
      <h3>Assets</h3>
      <table style={tableStyle}>
        <thead><tr style={theadStyle}><th style={th}>Code</th><th style={th}>Account</th><th style={thRight}>Balance</th></tr></thead>
        <tbody>
          {assets.map(a => (
            <tr key={a.code} style={trStyle}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.name}</td>
              <td style={tdRight}>{Number(a.balance || 0).toLocaleString()}</td>
            </tr>
          ))}
          <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
            <td style={td} colSpan="2">Total Assets</td>
            <td style={tdRight}>{Number(data.totalAssets || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: '24px' }}>Liabilities</h3>
      <table style={tableStyle}>
        <tbody>
          {liabilities.map(a => (
            <tr key={a.code} style={trStyle}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.name}</td>
              <td style={tdRight}>{Number(a.balance || 0).toLocaleString()}</td>
            </tr>
          ))}
          <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
            <td style={td} colSpan="2">Total Liabilities</td>
            <td style={tdRight}>{Number(data.totalLiabilities || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: '24px' }}>Equity</h3>
      <table style={tableStyle}>
        <tbody>
          {equity.map(a => (
            <tr key={a.code} style={trStyle}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.name}</td>
              <td style={tdRight}>{Number(a.balance || 0).toLocaleString()}</td>
            </tr>
          ))}
          <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
            <td style={td} colSpan="2">Total Equity</td>
            <td style={tdRight}>{Number(data.equityTotal || 0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ==================== JOURNAL ====================
function JournalList({ data }) {
  const entries = Array.isArray(data) ? data : [];
  if (entries.length === 0) return <EmptyMsg msg="No journal entries." />;

  return (
    <div>
      {entries.map(entry => (
        <div key={entry._id} style={{ marginBottom: '20px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong>{entry.entryNumber}</strong>
            <span>{new Date(entry.date).toLocaleDateString()}</span>
          </div>
          <p style={{ margin: '4px 0', color: '#64748b', fontSize: '13px' }}>{entry.description}</p>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead><tr style={{ background: '#f8fafc' }}><th style={th}>Account</th><th style={thRight}>Debit</th><th style={thRight}>Credit</th></tr></thead>
            <tbody>
              {(entry.lines || []).map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{l.accountCode} - {l.accountName}</td>
                  <td style={tdRight}>{l.debit ? Number(l.debit).toLocaleString() : '-'}</td>
                  <td style={tdRight}>{l.credit ? Number(l.credit).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ==================== HELPERS ====================
const StatCard = ({ label, value, color, bg, icon, raw }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '12px', color, fontWeight: '500' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color }}>
        {raw ? Number(value || 0).toLocaleString() : `UGX ${Number(value || 0).toLocaleString()}`}
      </div>
    </div>
    <span style={{ fontSize: '22px' }}>{icon}</span>
  </div>
);

const ChartCard = ({ title, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px' }}>
    <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', color: '#334155' }}>{title}</h3>
    {children}
  </div>
);

const EmptyMsg = ({ msg }) => (
  <p style={{ color: '#6b7280', textAlign: 'center', padding: '30px', fontSize: '13px' }}>{msg || 'No data yet.'}</p>
);

const StatusBadge = ({ status }) => {
  const colors = {
    active: ['#dcfce7', '#065f46'],
    disbursed: ['#fef9e7', '#b45309'],
    pending: ['#e0f2fe', '#0369a1'],
    approved: ['#dbeafe', '#1e40af'],
    closed: ['#f1f5f9', '#475569'],
    rejected: ['#fee2e2', '#991b1b'],
    writeOff: ['#fee2e2', '#991b1b']
  };
  const [bg, color] = colors[status] || ['#f1f5f9', '#475569'];
  return <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: 11, background: bg, color, fontWeight: 600 }}>{status}</span>;
};

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
const theadStyle = { background: '#f8fafc', borderBottom: '2px solid #e5e7eb' };
const th = { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#334155' };
const thRight = { ...th, textAlign: 'right' };
const td = { padding: '10px', borderBottom: '1px solid #f1f5f9' };
const tdRight = { ...td, textAlign: 'right' };
const trStyle = {};