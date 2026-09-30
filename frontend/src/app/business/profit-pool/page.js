'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../api-client';

export default function ProfitPoolPage() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [ratio, setRatio] = useState(null);
  const [multiYear, setMultiYear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExtract, setShowExtract] = useState(false);
  const [extractAmount, setExtractAmount] = useState('');
  const [extractNotes, setExtractNotes] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [s, h, r, m] = await Promise.all([
        apiFetch('/api/business/profit-pool/status').then(r => r.json()),
        apiFetch('/api/business/profit-pool/history').then(r => r.json()),
        apiFetch('/api/business/profit-pool/ratio').then(r => r.json()),
        apiFetch('/api/business/profit-pool/multi-year').then(r => r.json())
      ]);
      setStatus(s);
      setHistory(h.history || []);
      setRatio(r);
      setMultiYear(m.businesses || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const submitExtract = async () => {
    setMsg('');
    try {
      const res = await apiFetch('/api/business/profit-pool/extract', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(extractAmount), notes: extractNotes, extractedBy: 'admin' })
      });
      const d = await res.json();
      if (res.ok) {
        setMsg('✅ ' + d.message);
        setExtractAmount(''); setExtractNotes('');
        setShowExtract(false);
        fetchAll();
      } else setMsg('❌ ' + (d.error || 'Failed'));
    } catch (err) { setMsg('❌ Network error'); }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>;

  const years = [...new Set(multiYear.flatMap(b => Object.keys(b.byYear)))].sort();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>💰 Consolidated Profit Pool</h1>
        <a href="/business" style={btnSecondary}>← All Businesses</a>
      </div>

      {msg && <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '16px', background: msg.startsWith('✅') ? '#dcfce7' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', fontWeight: '600' }}>{msg}</div>}

      <div style={{ background: 'linear-gradient(135deg, #0f3460, #1e40af)', color: '#fff', padding: '24px', borderRadius: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', opacity: 0.85 }}>CURRENT POOL BALANCE</div>
        <div style={{ fontSize: '38px', fontWeight: '700', marginTop: '6px' }}>UGX {Number(status?.balance || 0).toLocaleString()}</div>
        <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '13px', opacity: 0.85 }}>
          <div>Total Declared: <strong>UGX {Number(status?.totalDeclared || 0).toLocaleString()}</strong></div>
          <div>Total Extracted: <strong>UGX {Number(status?.totalExtracted || 0).toLocaleString()}</strong></div>
        </div>
        {status?.balance > 0 && (
          <button onClick={() => setShowExtract(true)} style={{ marginTop: '16px', padding: '10px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            📤 Extract to Club Capital
          </button>
        )}
      </div>

      {ratio && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <SummaryCard title="Club Capital" value={ratio.clubCapital} color="#0369a1" bg="#e0f2fe" />
          <SummaryCard title="From Business Profits" value={ratio.totalBusinessProfitExtracted} color="#15803d" bg="#dcfce7" />
          <div style={{ background: '#fef9e7', padding: '14px 16px', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '500' }}>Business Profit % of Club Capital</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#b45309' }}>{ratio.profitPercentOfCapital}%</div>
          </div>
        </div>
      )}

      {multiYear.length > 0 && years.length > 0 && (
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, fontSize: '14px', textTransform: 'uppercase', color: '#334155' }}>Multi-Year Profit Tracking</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>Business</th>
                {years.map(y => <th key={y} style={{ ...th, textAlign: 'right' }}>{y}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {multiYear.map(b => (
                <tr key={b.businessId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}><strong>{b.businessName}</strong></td>
                  {years.map(y => <td key={y} style={{ ...td, textAlign: 'right' }}>UGX {Number(b.byYear[y] || 0).toLocaleString()}</td>)}
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700', color: '#15803d' }}>UGX {Number(b.totalDeclared || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Full History</h3>
      {history.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No profit movements yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={th}>Declaration #</th>
                <th style={th}>Date</th>
                <th style={th}>Business</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>By</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ ...td, fontWeight: '600', color: '#0f3460' }}>{h.declarationNumber}</td>
                  <td style={td}>{new Date(h.date).toLocaleDateString()}</td>
                  <td style={td}>{h.businessName}</td>
                  <td style={td}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                      background: h.type === 'declaration' ? '#e0f2fe' : h.type === 'extraction' ? '#dcfce7' : h.type === 'milestone' ? '#fef9e7' : '#f1f5f9',
                      color: h.type === 'declaration' ? '#0369a1' : h.type === 'extraction' ? '#065f46' : h.type === 'milestone' ? '#b45309' : '#475569'
                    }}>{h.type}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: '700' }}>UGX {Number(h.amount || 0).toLocaleString()}</td>
                  <td style={td}>{h.declaredBy}</td>
                  <td style={{ ...td, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showExtract && (
        <div style={modalBg}>
          <div style={modalBox}>
            <h3 style={{ marginTop: 0 }}>Extract to Club Capital</h3>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Available in pool: <strong>UGX {Number(status?.balance || 0).toLocaleString()}</strong></p>
            <Field label="Amount (UGX)"><input type="number" value={extractAmount} onChange={e => setExtractAmount(e.target.value)} style={input} /></Field>
            <Field label="Notes"><input type="text" value={extractNotes} onChange={e => setExtractNotes(e.target.value)} style={input} /></Field>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={submitExtract} style={btn('#22c55e')}>Confirm</button>
              <button onClick={() => setShowExtract(false)} style={btn('#6b7280')}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({ title, value, color, bg }) => (
  <div style={{ background: bg, padding: '14px 16px', borderRadius: '10px' }}>
    <div style={{ fontSize: '12px', color, fontWeight: '500' }}>{title}</div>
    <div style={{ fontSize: '22px', fontWeight: '700', color }}>UGX {Number(value || 0).toLocaleString()}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>{label}</label>
    {children}
  </div>
);

const btn = (bg) => ({ padding: '10px 18px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' });
const btnSecondary = { padding: '10px 20px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const input = { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' };
const th = { padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' };
const td = { padding: '10px 12px' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', padding: '24px', borderRadius: '14px', width: '480px', maxWidth: '95vw' };