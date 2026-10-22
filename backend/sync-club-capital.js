const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/pesaflow').then(async () => {
  const Account = require('./models/Account');
  const Saving = require('./models/Saving');

  const CLUB_CATEGORIES = ['misc', 'penalty', 'donation', 'membership', 'business_profit', 'shares'];

  const savings = await Saving.find({ category: { $in: CLUB_CATEGORIES } });
  const total = savings.reduce((s, x) => s + Number(x.amount || 0), 0);

  let acc = await Account.findOne({ code: '1000' });
  const before = acc ? Number(acc.balance) : 0;

  if (!acc) {
    acc = await Account.create({
      code: '1000',
      name: 'Club Capital',
      type: 'Equity',
      balance: total
    });
    console.log('Created Account 1000 with balance:', total);
  } else {
    acc.balance = total;
    await acc.save();
    console.log('Account 1000 balance: ' + before + ' -> ' + total);
  }

  console.log('');
  console.log('Categories summed:', CLUB_CATEGORIES.join(', '));
  console.log('Savings documents counted:', savings.length);
  console.log('New Club Capital balance:', total);

  process.exit(0);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });