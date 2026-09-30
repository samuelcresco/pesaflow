const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/pesaflow');

const createAdmin = async () => {
  try {
    // Delete existing admin if any
    await User.deleteOne({ memberNumber: 'ADMIN001' });

    const hashedPassword = await bcrypt.hash('password', 10);
    const admin = new User({
      memberNumber: 'ADMIN001',
      password: hashedPassword,
      role: 'admin',
      fname: 'Admin',
      lname: 'User',
      phoneNumber: '0712345678',
      email: 'admin@pesaflow.com'
    });

    await admin.save();
    console.log('✅ Admin created successfully!');
    console.log('📋 Member Number: ADMIN001');
    console.log('🔑 Password: password');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

createAdmin();