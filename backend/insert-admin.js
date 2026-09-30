const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const url = 'mongodb://localhost:27017';
const dbName = 'pesaflow';

async function createAdmin() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection('users');

    // Delete existing admin
    await users.deleteOne({ memberNumber: 'ADMIN001' });

    // Hash password
    const hashedPassword = await bcrypt.hash('password', 10);

    const admin = {
      memberNumber: 'ADMIN001',
      password: hashedPassword,
      role: 'admin',
      fname: 'Admin',
      lname: 'User',
      phoneNumber: '0712345678',
      email: 'admin@pesaflow.com'
    };

    await users.insertOne(admin);
    console.log('✅ Admin created with hashed password!');
    console.log('📋 Member Number: ADMIN001');
    console.log('🔑 Password: password');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

createAdmin();
