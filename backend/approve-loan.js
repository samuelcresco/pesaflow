const mongoose = require('mongoose');
const User = require('./models/users.models');

mongoose.connect('mongodb://localhost:27017/pesaflow');

async function approveLoan() {
  try {
    const member = await User.findOne({ memberNumber: 'crested001' });
    if (!member) {
      console.log('❌ Member not found');
      return;
    }
    if (!member.loans || member.loans.length === 0) {
      console.log('❌ No loans found');
      return;
    }
    console.log('Current status:', member.loans[0].status);
    member.loans[0].status = 'Approved';
    await member.save();
    console.log('✅ Loan approved! New status:', member.loans[0].status);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

approveLoan();
