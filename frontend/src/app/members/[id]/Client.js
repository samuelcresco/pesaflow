'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

export default function MemberProfile() {
  const params = useParams();
  const id = params.id;
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await axios.get(`https://pesaflow-api-jpll.onrender.com/api/users/${id}`);
        setMember(response.data);
      } catch (err) {
        setError('Member not found');
        console.error('Error fetching member:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchMember();
    }
  }, [id]);

  const shareColors = {
    Platinum: '#e6b800',
    Golden: '#ffd700',
    Silver: '#c0c0c0',
    Ordinary: '#cd7f32'
  };

  const statusColors = {
    Active: '#28a745',
    Inactive: '#dc3545',
    Suspended: '#ffc107'
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  if (error || !member) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Member not found</h2>
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
              <img src={member.photo} alt={member.fname} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#333' }}>
                {member.fname?.[0]}{member.lname?.[0]}
              </div>
            )}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>{member.fname} {member.lname}</h1>
            <p style={{ margin: '5px 0' }}>Member Number: {member.memberNumber}</p>
            <span style={{
              background: statusColors[member.status] || '#28a745',
              padding: '4px 12px',
              borderRadius: '20px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {member.status || 'Active'}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Contact Details */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>📞 Contact Details</h3>
              <p><strong>Email:</strong> {member.email}</p>
              <p><strong>Phone:</strong> {member.phoneNumber}</p>
              <p><strong>Address:</strong> {member.address || 'Not provided'}</p>
            </div>

            {/* Personal Info */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🪪 Personal Info</h3>
              <p><strong>ID Number:</strong> {member.idNumber || 'Not provided'}</p>
              <p><strong>Occupation:</strong> {member.occupation || 'Not provided'}</p>
              <p><strong>Date Joined:</strong> {member.dateJoined ? new Date(member.dateJoined).toLocaleDateString() : 'Not provided'}</p>
            </div>

            {/* Share Details */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>🏷️ Share Details</h3>
              <p><strong>Share Type:</strong> <span style={{
                background: shareColors[member.shareType] || '#cd7f32',
                padding: '4px 8px',
                borderRadius: '4px',
                color: 'white',
                fontWeight: 'bold'
              }}>{member.shareType || 'Ordinary'}</span></p>
              <p><strong>Number of Shares:</strong> {member.numberOfShares || 0}</p>
              <p><strong>Total Value:</strong> {member.totalShareValue?.toLocaleString() || 0} UGX</p>
            </div>

            {/* Next of Kin */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>👨‍👩‍👦 Next of Kin</h3>
              {member.nextOfKin?.fullName ? (
                <>
                  <p><strong>Name:</strong> {member.nextOfKin.fullName}</p>
                  <p><strong>Relationship:</strong> {member.nextOfKin.relationship || 'Not specified'}</p>
                  <p><strong>Phone:</strong> {member.nextOfKin.phone || 'Not provided'}</p>
                  <p><strong>Email:</strong> {member.nextOfKin.email || 'Not provided'}</p>
                  {member.nextOfKin.photo && (
                    <img src={member.nextOfKin.photo} alt="NOK" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginTop: '10px' }} />
                  )}
                </>
              ) : (
                <p>No next of kin recorded</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
