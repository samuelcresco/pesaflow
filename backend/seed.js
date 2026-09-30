const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedUsers = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pesaflow');

    const users = [
      { 
        memberNumber: 'MEM001', 
        password: 'password', 
        role: 'admin', 
        fname: 'Admin', 
        Iname: 'User',
        PhoneNumber: '0700000000',
        email: 'admin@pesaflow.com' 
      },
      { 
        memberNumber: 'MEM002', 
        password: 'password', 
        role: 'member', 
        fname: 'Member', 
        Iname: 'One',
        PhoneNumber: '0711111111',
        email: 'member1@pesaflow.com' 
      },
      { 
        memberNumber: 'MEM003', 
        password: 'password', 
        role: 'member', 
        fname: 'Member', 
        Iname: 'Two',
        PhoneNumber: '0722222222',
        email: 'member2@pesaflow.com' 
      },
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await User.create({
        memberNumber: user.memberNumber,
        password: hashedPassword,
        role: user.role,
        fname: user.fname,
        Iname: user.Iname,
        PhoneNumber: user.PhoneNumber,
        email: user.email
      });
    }

    console.log('✅ Demo users created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedUsers();