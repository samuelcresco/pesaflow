'use client';

import { useEffect, useState } from 'react';
import MemberSearch, { filterBySearch } from '../../components/MemberSearch';
import { apiFetch } from '../api-client';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await apiFetch('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    try {
      await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err) {
      alert('Failed to delete member');
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading members...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red' }}>{error}</div>;

  const filteredMembers = filterBySearch(members, search, [
    'firstName',
    'surname',
    'memberNumber',
    'email',
    'contact',
    'occupation'
  ]);

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 Members</h1>
        <a href="/members/add" style={{
          padding: '10px 20px',
          background: '#2563eb',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600'
        }}>+ Add Member</a>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <MemberSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by name, member number, phone, or email..."
        />
        {search && (
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
            Showing {filteredMembers.length} of {members.length} members
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No members yet.</p>
      ) : filteredMembers.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No members match "{search}".</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#0f3460', color: '#fff' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Member Number</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, i) => (
                <tr key={member._id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '12px' }}>{member.memberNumber}</td>
                  <td style={{ padding: '12px' }}>{member.firstName} {member.surname}</td>
                  <td style={{ padding: '12px' }}>{member.email}</td>
                  <td style={{ padding: '12px' }}>{member.contact}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: member.active !== false ? '#d1fae5' : '#fee2e2',
                      color: member.active !== false ? '#065f46' : '#991b1b'
                    }}>
                      {member.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <a
                      href={`/members/edit/${member._id}`}
                      style={{
                        padding: '5px 12px',
                        background: '#0f3460',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        marginRight: '5px',
                        display: 'inline-block'
                      }}
                    >Edit</a>
                    <button
                      onClick={() => handleDelete(member._id)}
                      style={{
                        padding: '5px 12px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <a href="/dashboard" style={{ color: '#2563eb', textDecoration: 'none' }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}