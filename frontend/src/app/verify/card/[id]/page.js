'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function VerifyCardPage() {
  const params = useParams();
  const id = params.id;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sig, setSig] = useState('');

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    setSig(qp.get('sig') || '');
  }, []);

  useEffect(() => {
    if (!id || !sig) return;

    fetch(`http://localhost:5000/api/member-cards/verify/${id}?sig=${sig}`)
      .then(r => r.json())
      .then(d => setResult(d))
      .catch(() => setResult({ valid: false, error: 'Network error' }))
      .finally(() => setLoading(false));
  }, [id, sig]);

  if (loading || !sig) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ padding: '40px', color: '#64748b' }}>Verifying card…</div>
      </div>
    );
  }

  const valid = result?.valid;
  const member = result?.member;
  const shares = member?.shares;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f3460, #0a2540)', fontFamily: 'Segoe UI, sans-serif', padding: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '40px 36px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {valid ? (
          <>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '44px' }}>
              ✅
            </div>
            <h1 style={{ color: '#15803d', margin: 0, fontSize: '26px', fontWeight: 800 }}>VALID CARD</h1>
            <p style={{ color: '#64748b', marginTop: '8px', marginBottom: '28px', fontSize: '14px' }}>
              This is a genuine Crested SS Investment Club identity card.
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', textAlign: 'left', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Member Name</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f3460', marginBottom: '14px' }}>{member?.name}</div>

              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Member Number</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f3460', marginBottom: '14px' }}>{member?.memberNumber}</div>

              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Member Since</div>
              <div style={{ fontSize: '14px', color: '#334155' }}>
                {member?.joined ? new Date(member.joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </div>
            </div>

            {/* Shares summary */}
            <div style={{ background: 'linear-gradient(135deg, #0f3460, #1e40af)', borderRadius: '12px', padding: '22px 20px', textAlign: 'left', marginBottom: '20px', color: '#ffffff' }}>
              <div style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                Total Shares Held
              </div>
              <div style={{ fontSize: '38px', fontWeight: 800, color: '#c9a227', lineHeight: 1, marginBottom: '14px' }}>
                {shares?.total ?? 0}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span>Golden</span><strong>{shares?.golden ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span>Platinum</span><strong>{shares?.platinum ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span>Silver</span><strong>{shares?.silver ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span>Bronze</span><strong>{shares?.bronze ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* Admin custom message */}
            {member?.cardQrMessage && member.cardQrMessage.trim() && (
              <div style={{
                background: '#fef9e7',
                border: '1px solid #fcd34d',
                borderRadius: '12px',
                padding: '16px 18px',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                <div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: '6px' }}>
                  Message from the Club
                </div>
                <div style={{ fontSize: '14px', color: '#78350f', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {member.cardQrMessage}
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Verified at {new Date(result.verifiedAt).toLocaleString()}
            </div>
          </>
        ) : (
          <>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '44px' }}>
              ❌
            </div>
            <h1 style={{ color: '#991b1b', margin: 0, fontSize: '26px', fontWeight: 800 }}>INVALID CARD</h1>
            <p style={{ color: '#64748b', marginTop: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {result?.error || 'This card could not be verified.'}
            </p>
            <div style={{ background: '#fef2f2', padding: '14px', borderRadius: '10px', fontSize: '12px', color: '#991b1b' }}>
              If you believe this is a mistake, contact the club office.
            </div>
          </>
        )}
      </div>
    </div>
  );
}