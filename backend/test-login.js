const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/users.models');

mongoose.connect('mongodb://localhost:27017/pesaflow');

async function testLogin() {
  try {
    const memberNumber = 'crested001';
    const password = 'DQp0FQDD';

    console.log('🔍 Testing login for:', memberNumber);

    const user = await User.findOne({ memberNumber: memberNumber }).select('+password');
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log('📝 Stored hash:', user.password);
    console.log('🔑 Testing password:', password);

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
      console.log('✅ Password MATCHES!');
      console.log('👉 You can login with crested001 / DQp0FQDD');
    } else {
      console.log('❌ Password DOES NOT MATCH');
      console.log('🔧 Need to reset password');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testLogin();