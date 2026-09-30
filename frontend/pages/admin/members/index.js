import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MembersList() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/members');
      const data = await res.json();

      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        setError(data.error || 'Failed to load members');
      }
    } catch (error) {
      setError('Network error – is backend running?');
    } finally {
      setLoading(false);
    }
  };

  const deleteMember = async (id) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/members/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('Member deleted');
        fetchMembers();
      } else {
        alert('Failed to delete');
      }
    } catch (error) {
      alert('Network error');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading members...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  if (members.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <p>No members found.</p>
        <Link href="/admin/members/new">
          <button style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Add New Member
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Member Management</h1>
        <Link href="/admin/members/new">
          <button style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Add New Member
          </button>
        </Link>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Member No.</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Full Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Contact</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Total Shares</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, idx) => (
              <tr key={member._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                <td style={{ padding: '12px' }}>{member.memberNumber}</td>
                <td style={{ padding: '12px' }}>{member.firstName} {member.surname}</td>
                <td style={{ padding: '12px' }}>{member.contact}</td>
                <td style={{ padding: '12px' }}>{member.email}</td>
                <td style={{ padding: '12px' }}>{member.totalShares || 0}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: member.active ? '#d1fae5' : '#fee2e2',
                    color: member.active ? '#065f46' : '#991b1b'
                  }}>
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <Link href={`/admin/members/${member._id}`}>
                    <button style={{ padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' }}>View</button>
                  </Link>
                  <Link href={`/admin/members/edit/${member._id}`}>
                    <button style={{ padding: '4px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' }}>Edit</button>
                  </Link>
                  <button onClick={() => deleteMember(member._id)} style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
