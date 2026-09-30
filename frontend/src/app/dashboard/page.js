'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '../api-client';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [cardAccess, setCardAccess] = useState([]);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [roleView, setRoleView] = useState('');

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    if (localStorage.getItem('mustChangePassword') === 'true') {
      router.replace('/change-password');
      return;
    }
    setUser(s.user);
    setRole(s.role);
    setCardAccess(s.cardAccess === 'all' ? 'all' : (() => { try { return JSON.parse(s.cardAccess || '[]'); } catch { return []; } })());
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;
  if (!user) return null;

  const allCards = [
    { title: 'Members', desc: 'Manage member accounts', icon: '👥', href: '/members', bg: '#e0f2fe', id: 'members' },
    { title: 'Savings', desc: 'Track member savings', icon: '💰', href: '/savings', bg: '#dcfce7', id: 'savings' },
    { title: 'Loans', desc: 'Manage loan applications', icon: '🏦', href: '/loans', bg: '#fef9e7', id: 'loans' },
    { title: 'Withdrawals', desc: 'June / Dec withdrawals', icon: '💸', href: '/withdrawals', bg: '#fce7f3', id: 'withdrawals' },
    { title: 'Receipts', desc: 'Receipts & vouchers', icon: '🧾', href: '/receipts', bg: '#f3e8ff', id: 'receipts' },
    { title: 'Statements', desc: 'Member ledger statements', icon: '📊', href: '/statements', bg: '#e0f2fe', id: 'statements' },
    { title: 'Business', desc: 'Products, sales & profit pool', icon: '💼', href: '/business', bg: '#dbeafe', id: 'business' },
    { title: 'Dividends', desc: 'Distribute dividends', icon: '💵', href: '/dividends', bg: '#dcfce7', id: 'dividends' },
    { title: 'Club Investments', desc: 'Manage club assets', icon: '🏘️', href: '/investments', bg: '#fef3c7', id: 'investments' },
    { title: 'Expenses', desc: 'Club & business expenses', icon: '🧮', href: '/expenses', bg: '#fee2e2', id: 'expenses' },
    { title: 'Delivery Notes', desc: 'Goods delivered to recipients', icon: '📄', href: '/delivery-notes', bg: '#cffafe', id: 'delivery-notes' },
    { title: 'Reports', desc: 'Analytics, P&L, Balance Sheet', icon: '📈', href: '/reports', bg: '#cffafe', id: 'reports' },
    { title: 'Share Settings', desc: 'Prices, dividends, eligibility', icon: '⚙️', href: '/admin/share-settings', bg: '#e5e7eb', id: 'share-settings' },
    { title: 'Leaders', desc: 'Leadership & logins', icon: '🏛️', href: '/admin/leaders', bg: '#fef3c7', id: 'leaders' },
    { title: 'Club Profile', desc: 'Club details for PDFs', icon: '🏢', href: '/admin/club-profile', bg: '#dbeafe', id: 'club-profile' }
  ];

  const ROLE_PREVIEW = {
    president: ['members','savings','loans','withdrawals','receipts','statements','business','dividends','investments','expenses','delivery-notes','reports','share-settings','leaders','club-profile'],
    vice_president: ['members','savings','loans','withdrawals','receipts','statements','business','dividends','investments','expenses','delivery-notes','reports','share-settings','leaders','club-profile'],
    secretary: ['members','savings','receipts','statements','reports'],
    treasurer: ['savings','withdrawals','receipts','statements','dividends','expenses','reports'],
    chairman_loan_committee: ['loans','statements','reports'],
    treasurer_loan_committee: ['loans','statements','reports'],
    loan_officer_1: ['loans'],
    loan_officer_2: ['loans'],
    chair_investment_committee: ['business','investments','expenses','delivery-notes','reports']
  };

  const isAdmin = role === 'admin' || role === 'it_technician';
  let effectiveAccess = isAdmin ? 'all' : cardAccess;
  if (isAdmin && roleView) effectiveAccess = ROLE_PREVIEW[roleView] || [];

  const visibleCards = (effectiveAccess === 'all')
    ? allCards
    : allCards.filter(c => effectiveAccess.includes(c.id));

  return (
    <div style={{ padding: '20px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>CRESTED SS</h2>
          <h3 style={{ margin: '2px 0', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>INVESTMENT CLUB LTD</h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && (
            <select
              value={roleView}
              onChange={e => setRoleView(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', background: roleView ? '#fef9e7' : '#fff' }}
            >
              <option value="">👁️ Preview as...</option>
              <option value="president">President</option>
              <option value="vice_president">Vice President</option>
              <option value="secretary">Secretary</option>
              <option value="treasurer">Treasurer</option>
              <option value="chairman_loan_committee">Chairman — Loan</option>
              <option value="treasurer_loan_committee">Treasurer — Loan</option>
              <option value="loan_officer_1">Loan Officer 1</option>
              <option value="loan_officer_2">Loan Officer 2</option>
              <option value="chair_investment_committee">Chair — Investment</option>
            </select>
          )}
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ marginTop: '12px', marginBottom: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
          Welcome, <strong>{user.name || user.username || 'User'}</strong>
        </p>
        {role && role !== 'admin' && (
          <span style={{ padding: '2px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
            {role.replace(/_/g, ' ')}
          </span>
        )}
        {roleView && (
          <span style={{ fontSize: '12px', background: '#fef9e7', color: '#b45309', padding: '4px 10px', borderRadius: '8px', fontWeight: '600' }}>
            👁️ Previewing as {roleView.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {visibleCards.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <p style={{ color: '#64748b' }}>No cards assigned to your role. Contact the IT technician.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
          {visibleCards.map((c, i) => (
            <a key={i} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: c.bg, padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', height: '100%' }}>
                <div style={{ fontSize: '22px' }}>{c.icon}</div>
                <h3 style={{ margin: '6px 0 2px', fontSize: '14px', color: '#1e293b' }}>{c.title}</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '11px', lineHeight: 1.3 }}>{c.desc}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}