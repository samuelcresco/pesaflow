'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      fontFamily: 'Segoe UI, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>CRESTED SS</div>
        <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>INVESTMENT CLUB LTD</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', marginBottom: '40px' }}>
          SACCO Management Platform
        </div>

        <h2 style={{ color: '#1e293b', marginBottom: '8px' }}>Welcome</h2>
        <p style={{ color: '#64748b', marginBottom: '32px' }}>Choose your portal to continue</p>

        <Link href="/login" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '18px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '16px',
            cursor: 'pointer',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
          }}>
            👨‍💼 Admin Login
          </div>
        </Link>

        <Link href="/member-login" style={{ textDecoration: 'none' }}>
          <div style={{
            padding: '18px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(34,197,94,0.3)'
          }}>
            👤 Member Login
          </div>
        </Link>

        <div style={{ marginTop: '32px', fontSize: '12px', color: '#94a3b8' }}>
          &copy; {new Date().getFullYear()} Crested SS Investment Club
        </div>
      </div>
    </div>
  );
}