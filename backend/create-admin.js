const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/pesaflow');

const UserSchema = new mongoose.Schema({
  memberNumber: String,
  password: String,
  role: String,
  fname: String,
  lname: String,
  phoneNumber: String,
  email: String,
  isVerified: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
  try {
    // Delete existing ADMIN001
    await User.deleteOne({ memberNumber: 'ADMIN001' });

    const hashedPassword = await bcrypt.hash('password', 10);

    const admin = new User({
      memberNumber: 'ADMIN001',
      password: hashedPassword,
      role: 'admin',
      fname: 'Admin',
      lname: 'User',
      phoneNumber: '0712345678',
      email: 'admin@crestedss.com',
      isVerified: true
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
}

createAdmin();