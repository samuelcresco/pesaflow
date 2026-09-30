'use client';

import { useState } from 'react';

export default function PdfOptionsModal({ title, baseUrl, onClose }) {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const [from, setFrom] = useState(yearStart.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);

  const setPreset = (preset) => {
    const now = new Date();
    let f, t;

    if (preset === 'this_month') {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      t = now;
    } else if (preset === 'last_month') {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'last_3') {
      f = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      t = now;
    } else if (preset === 'last_6') {
      f = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      t = now;
    } else if (preset === 'this_year') {
      f = new Date(now.getFullYear(), 0, 1);
      t = now;
    } else if (preset === 'last_year') {
      f = new Date(now.getFullYear() - 1, 0, 1);
      t = new Date(now.getFullYear() - 1, 11, 31);
    } else if (preset === 'all_time') {
      f = new Date('2015-01-01');
      t = now;
    }

    setFrom(f.toISOString().split('T')[0]);
    setTo(t.toISOString().split('T')[0]);
  };

  const handlePreview = () => {
    const url = `${baseUrl}?from=${from}&to=${to}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div style={{
        background: '#fff', padding: '24px', borderRadius: '14px',
        width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>📄 {title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500' }}>Quick Ranges</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
          <PresetBtn onClick={() => setPreset('this_month')}>This Month</PresetBtn>
          <PresetBtn onClick={() => setPreset('last_month')}>Last Month</PresetBtn>
          <PresetBtn onClick={() => setPreset('last_3')}>Last 3 Months</PresetBtn>
          <PresetBtn onClick={() => setPreset('last_6')}>Last 6 Months</PresetBtn>
          <PresetBtn onClick={() => setPreset('this_year')}>This Year</PresetBtn>
          <PresetBtn onClick={() => setPreset('last_year')}>Last Year</PresetBtn>
          <PresetBtn onClick={() => setPreset('all_time')}>All Time</PresetBtn>
        </div>

        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>From</label>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          style={input}
        />

        <label style={{ display: 'block', marginBottom: '4px', marginTop: '12px', fontSize: '13px', fontWeight: '500' }}>To</label>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          style={input}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={handlePreview} style={btnPrimary}>👁️ Preview PDF</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', textAlign: 'center' }}>
          PDF will open in a new tab. Download or print from there.
        </p>
      </div>
    </div>
  );
}

const PresetBtn = ({ children, onClick }) => (
  <button onClick={onClick} style={{
    padding: '6px 12px', background: '#f1f5f9', color: '#334155',
    border: '1px solid #e2e8f0', borderRadius: '20px', fontSize: '12px',
    cursor: 'pointer', fontWeight: '500'
  }}>{children}</button>
);

const input = {
  width: '100%', padding: '10px', border: '1px solid #d1d5db',
  borderRadius: '8px', fontSize: '14px'
};
const btnPrimary = {
  padding: '10px 20px', background: '#7c3aed', color: '#fff',
  border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
};
const btnSecondary = {
  padding: '10px 20px', background: '#e5e7eb', color: '#1f2937',
  border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
};