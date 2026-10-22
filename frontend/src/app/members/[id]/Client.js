'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, API } from '../../api-client';
import PdfOptionsModal from '../../../components/PdfOptionsModal';

export default function MemberProfile() {
  const params = useParams();
  const id = params.id;
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfModal, setPdfModal] = useState(null);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const res = await apiFetch(`/api/members/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Member not found');
        setMember(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMember();
  }, [id]);

  // ============ COMPUTED FIELDS ============
  const shareTotals = member?.shares || { golden: 0, platinum: 0, silver: 0, bronze: 0 };
  const totalShares = (shareTotals.golden || 0) + (shareTotals.platinum || 0) + (shareTotals.silver || 0) + (shareTotals.bronze || 0);

  // Which share type does the member have the most of
  const dominantShareType = (() => {
    const entries = [
      ['Platinum', shareTotals.platinum || 0],
      ['Golden', shareTotals.golden || 0],
      ['Silver', shareTotals.silver || 0],
      ['Ordinary', shareTotals.bronze || 0]
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : 'None';
  })();

  const statusColor = member?.active === false ? '#dc3545' : '#28a745';
  const statusLabel = member?.active === false ? 'Inactive' : 'Active';

  const shareColors = {
    Platinum: '#e6b800',
    Golden: '#ffd700',
    Silver: '#c0c0c0',
    Ordinary: '#cd7f32',
    None: '#94a3b8'
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  if (error || !member) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>{error || 'Member not found'}</h2>
        <a href="/members" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back to Members</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px' }}>
      <a href="/members" style={{ color: '#0f3460', textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }}>← Back to Members</a>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

        {/* Header with Photo and Name */}
        <div style={{ background: '#0f3460', padding: '30px', color: 'white', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            {member.photo ? (
              <img src={member.photo} alt={member.firstName} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#333' }}>
                {member.firstName?.[0]}{member.surname?.[0]}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>{member.firstName} {member.surname}</h1>
            <p style={{ margin: '5px 0' }}>Member Number: {member.memberNumber}</p>
            <span style={{
              background: statusColor,
              padding: '4px 12px',
              borderRadius: '20px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>{statusLabel}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setPdfModal({
                title: `Member Card — ${member.memberNumber}`,
                url: `${API}/api/members/${member._id}/card/pdf`
              })}
              style={{ padding: '10px 18px', background: '#c9a227', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            >
              🪪 Print Identity Card
            </button>
            <button
              onClick={() => setPdfModal({
                title: `Statement — ${member.memberNumber}`,
                url: `${API}/api/members/${member._id}/statement/pdf`
              })}
              style={{ padding: '10px 18px', background: '#ffffff', color: '#0f3460', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            >
              📄 Download Statement
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Contact Details */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>📞 Contact Details</h3>
              <p><strong>Email:</strong> {member.email || '—'}</p>
              <p><strong>Phone:</strong> {member.contact || '—'}</p>
              <p><strong>Address:</strong> {member.address || 'Not provided'}</p>
            </div>

            {/* Personal Info */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🪪 Personal Info</h3>
              <p><strong>Occupation:</strong> {member.occupation || 'Not provided'}</p>
              <p><strong>Date of Birth:</strong> {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : '—'}</p>
              <p><strong>Date Joined:</strong> {member.dateOfSubscription ? new Date(member.dateOfSubscription).toLocaleDateString() : '—'}</p>
            </div>

            {/* Share Details */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🏷️ Share Details</h3>
              <p><strong>Dominant Share:</strong>{' '}
                <span style={{
                  background: shareColors[dominantShareType] || '#cd7f32',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: 'bold'
                }}>{dominantShareType}</span>
              </p>
              <p><strong>Total Shares:</strong> {totalShares}</p>
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
                <div>Golden: <strong>{shareTotals.golden || 0}</strong></div>
                <div>Platinum: <strong>{shareTotals.platinum || 0}</strong></div>
                <div>Silver: <strong>{shareTotals.silver || 0}</strong></div>
                <div>Bronze: <strong>{shareTotals.bronze || 0}</strong></div>
              </div>
            </div>

            {/* Savings */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>💰 Savings</h3>
              <p><strong>Total Savings:</strong> UGX {(member.savings || 0).toLocaleString()}</p>
              <p><strong>Locked (Loan):</strong> UGX {(member.lockedSavings || 0).toLocaleString()}</p>
              <p><strong>Dividend Balance:</strong> UGX {(member.dividendBalance || 0).toLocaleString()}</p>
            </div>

            {/* Next of Kin */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', gridColumn: 'span 2' }}>
              <h3 style={{ marginTop: 0 }}>👨‍👩‍👦 Next of Kin</h3>
              {member.nextOfKin?.fullName ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <p><strong>Name:</strong> {member.nextOfKin.fullName}</p>
                  <p><strong>Relationship:</strong> {member.nextOfKin.relationship || '—'}</p>
                  <p><strong>Phone:</strong> {member.nextOfKin.contact || '—'}</p>
                  <p><strong>Email:</strong> {member.nextOfKin.email || '—'}</p>
                  <p style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {member.nextOfKin.address || '—'}</p>
                </div>
              ) : (
                <p>No next of kin recorded</p>
              )}
            </div>

          </div>
        </div>
      </div>

      {pdfModal && (
        <PdfOptionsModal
          title={pdfModal.title}
          baseUrl={pdfModal.url}
          onClose={() => setPdfModal(null)}
        />
      )}
    </div>
  );
}