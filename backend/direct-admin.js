const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'pesaflow';

async function createAdmin() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection('users');

    // Check if admin already exists
    const existing = await users.findOne({ memberNumber: 'ADMIN001' });
    if (existing) {
      console.log('✅ Admin already exists: ADMIN001 / password');
      return;
    }

    const admin = {
      memberNumber: 'ADMIN001',
      password: 'password', // This will be hashed later, but for now we store plain text; we'll fix that if needed.
      role: 'admin',
      fname: 'Admin',
      lname: 'User',
      phoneNumber: '0712345678',
      email: 'admin@pesaflow.com'
    };

    await users.insertOne(admin);
    console.log('✅ Admin created: ADMIN001 / password');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

createAdmin();