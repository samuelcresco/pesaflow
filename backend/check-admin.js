const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'pesaflow';

async function checkAdmin() {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection('users');
    const user = await users.findOne({ memberNumber: 'ADMIN001' });
    if (user) {
      console.log('✅ Admin found:', user.memberNumber);
      console.log('   Role:', user.role);
      console.log('   Name:', user.fname, user.lname);
    } else {
      console.log('❌ Admin not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

checkAdmin();
