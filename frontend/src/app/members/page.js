'use client';

import { useEffect, useState } from 'react';
import MemberSearch, { filterBySearch } from '../../components/MemberSearch';
import { apiFetch } from '../api-client';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [constitutionFilter, setConstitutionFilter] = useState('all');

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

  const searchedMembers = filterBySearch(members, search, [
    'firstName',
    'surname',
    'memberNumber',
    'email',
    'contact',
    'occupation'
  ]);

  const filteredMembers = searchedMembers.filter(m => {
    if (constitutionFilter === 'paid') return m.constitutionPaid === true;
    if (constitutionFilter === 'unpaid') return m.constitutionPaid !== true;
    return true;
  });

  const paidCount = members.filter(m => m.constitutionPaid === true).length;
  const unpaidCount = members.length - paidCount;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 Members</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/admin/split-signatures" style={{
            padding: '10px 20px',
            background: '#c9a227',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600'
          }}>✂️ Split Signatures</a>
          <a href="/members/add" style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600'
          }}>+ Add Member</a>
        </div>
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

      {/* Constitution filter */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Constitution:</span>
        <button
          onClick={() => setConstitutionFilter('all')}
          style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1',
            background: constitutionFilter === 'all' ? '#0f3460' : '#fff',
            color: constitutionFilter === 'all' ? '#fff' : '#334155',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}
        >All ({members.length})</button>
        <button
          onClick={() => setConstitutionFilter('paid')}
          style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid #86efac',
            background: constitutionFilter === 'paid' ? '#16a34a' : '#dcfce7',
            color: constitutionFilter === 'paid' ? '#fff' : '#065f46',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}
        >✅ Paid ({paidCount})</button>
        <button
          onClick={() => setConstitutionFilter('unpaid')}
          style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid #fca5a5',
            background: constitutionFilter === 'unpaid' ? '#dc2626' : '#fee2e2',
            color: constitutionFilter === 'unpaid' ? '#fff' : '#991b1b',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}
        >❌ Unpaid ({unpaidCount})</button>
      </div>

      {members.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No members yet.</p>
      ) : filteredMembers.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No members match the current filters.</p>
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
                <th style={{ padding: '12px', textAlign: 'left' }}>Constitution</th>
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
                    {member.constitutionPaid ? (
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                        background: '#dcfce7', color: '#065f46'
                      }}>✅ Paid</span>
                    ) : (
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                        background: '#fee2e2', color: '#991b1b'
                      }}>❌ Unpaid</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <a
                      href={`/members/${member._id}`}
                      style={{
                        padding: '5px 12px',
                        background: '#0ea5e9',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        marginRight: '5px',
                        display: 'inline-block'
                      }}
                    >👁 View</a>
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