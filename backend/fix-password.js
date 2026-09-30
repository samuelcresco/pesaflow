const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/users.models');

mongoose.connect('mongodb://localhost:27017/pesaflow');

async function fixPassword() {
  const memberNumber = 'crested001';
  const newPassword = 'DQp0FQDD';
  
  const hashed = await bcrypt.hash(newPassword, 10);
  const user = await User.findOneAndUpdate(
    { memberNumber: memberNumber },
    { password: hashed },
    { new: true }
  );
  
  if (user) {
    console.log('✅ Password fixed for crested001');
    console.log('🔑 New password: DQp0FQDD');
  } else {
    console.log('❌ Member crested001 not found');
  }
  
  process.exit(0);
}

fixPassword();