// ============================================================
// ONE-TIME BACKFILL
// Run once:  node utils\backfillCategoryAccounts.js
//
// Reads historic Saving records and moves money from
// Account 1000 (Club Capital) into each category's own
// account, so the Club Stats cards reflect real figures.
//
// Total Club Capital does NOT change — it's just re-allocated.
// ============================================================

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pesaflow';

const CATEGORIES = [
  { cat: 'membership',  code: '1020', name: 'Membership Fees'  },
  { cat: 'shares',      code: '1030', name: 'Share Capital'    },
  { cat: 'constitution', code: '1040', name: 'Constitution Fees' },
  { cat: 'penalty',     code: '1050', name: 'Penalties'        },
  { cat: 'misc',        code: '1060', name: 'Miscellaneous'    },
  { cat: 'donation',    code: '1070', name: 'Donations'        }
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const Saving = require('../models/Saving');
  const Account = require('../models/Account');

  const clubAcc = await Account.findOne({ code: '1000' });
  if (!clubAcc) {
    console.error('❌ Account 1000 (Club Capital) not found. Aborting.');
    process.exit(1);
  }

  console.log(`🏦 Account 1000 current balance: UGX ${(Number(clubAcc.balance) || 0).toLocaleString()}`);
  console.log('');

  let totalMoved = 0;

  for (const { cat, code, name } of CATEGORIES) {
    // Sum all savings for this category
    const agg = await Saving.aggregate([
      { $match: { category: cat } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const total = Number(agg[0]?.total) || 0;

    if (total === 0) {
      console.log(`⏩ ${cat}: nothing to move`);
      continue;
    }

    // Find or create the destination account
    let destAcc = await Account.findOne({ code });
    if (!destAcc) {
      destAcc = await Account.create({
        code,
        name,
        type: 'Equity',
        balance: 0,
        category: 'club'
      });
      console.log(`➕ Created account ${code} — ${name}`);
    }

    const before = Number(destAcc.balance) || 0;

    // If the destination already has the exact amount, skip
    if (before === total) {
      console.log(`✅ ${cat}: already correct (${total.toLocaleString()})`);
      continue;
    }

    // Move the delta: set dest account = total, reduce Account 1000 by delta
    const delta = total - before;

    destAcc.balance = total;
    await destAcc.save();

    clubAcc.balance = Math.max(0, (Number(clubAcc.balance) || 0) - delta);
    await clubAcc.save();

    totalMoved += delta;

    console.log(`↔ ${cat}: ${before.toLocaleString()} → ${total.toLocaleString()} (moved ${delta.toLocaleString()} from 1000)`);
  }

  console.log('');
  console.log(`💠 Total moved out of Account 1000: UGX ${totalMoved.toLocaleString()}`);
  console.log(`🏦 Account 1000 final balance: UGX ${(Number(clubAcc.balance) || 0).toLocaleString()}`);
  console.log('');
  console.log('✅ Backfill complete. Restart the backend with: node app.js');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(e => {
  console.error('❌ Backfill error:', e);
  process.exit(1);
});