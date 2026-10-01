'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ApprovePage() {
  const [loans, setLoans] = useState([]);
  const [message, setMessage] = useState('');

  const fetchLoans = async () => {
    try {
      const res = await axios.get('https://pesaflow-api-jpll.onrender.com/api/loans/all');
      setLoans(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const approveLoan = async (memberNumber, loanIndex) => {
    if (!confirm('Approve this loan?')) return;
    try {
      const res = await axios.put(`https://pesaflow-api-jpll.onrender.com/api/loans/update/${memberNumber}/${loanIndex}`, {
        status: 'Approved'
      });
      if (res.data.success) {
        setMessage('✅ Loan approved!');
        fetchLoans(); // Refresh the list
      } else {
        setMessage('❌ Failed to approve.');
      }
    } catch (err) {
      setMessage('❌ Error: ' + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const pending = loans.filter(l => l.status === 'Pending');
  const approved = loans.filter(l => l.status === 'Approved');

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px' }}>
      <h2>Approve Loans</h2>
      {message && <p style={{ color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}

      <h3>Pending Loans ({pending.length})</h3>
      {pending.length === 0 ? <p>No pending loans.</p> : pending.map((loan, i) => (
        <div key={i} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '8px' }}>
          <p><strong>Member:</strong> {loan.memberName}</p>
          <p><strong>Amount:</strong> UGX {loan.amount}</p>
          <p><strong>Type:</strong> {loan.loanType}</p>
          <button onClick={() => approveLoan(loan.memberNumber, loan.loanIndex)} style={{ background: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Approve
          </button>
        </div>
      ))}

      <h3>Approved Loans ({approved.length})</h3>
      {approved.length === 0 ? <p>No approved loans yet.</p> : approved.map((loan, i) => (
        <div key={i} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '8px' }}>
          <p><strong>Member:</strong> {loan.memberName}</p>
          <p><strong>Amount:</strong> UGX {loan.amount}</p>
          <p><strong>Type:</strong> {loan.loanType}</p>
          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Approved</span>
        </div>
      ))}

      <br />
      <a href="/dashboard" style={{ color: '#0f3460', textDecoration: 'none' }}>← Back</a>
    </div>
  );
}