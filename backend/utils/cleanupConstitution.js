// ============================================================
// ONE-TIME CLEANUP SCRIPT
// Run once with:  node utils\cleanupConstitution.js
// Deletes all constitution records, restores savings, resets members,
// and removes the phantom amount from Account 1000.
// ============================================================

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pesaflow';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const Saving = require('../models/Saving');
  const Member = require('../models/Member');
  const Account = require('../models/Account');
  const Receipt = require('../models/Receipt');
  const JournalEntry = require('../models/JournalEntry');

  // 1. Find all constitution saving records
  const consSavings = await Saving.find({ category: 'constitution' });
  console.log(`📋 Found ${consSavings.length} constitution saving records`);

  // 2. Restore member savings for those who paid from savings (negative amounts)
  let restoredSavings = 0;
  for (const s of consSavings) {
    if (Number(s.amount) < 0 && s.memberId) {
      const m = await Member.findById(s.memberId);
      if (m) {
        m.savings = (Number(m.savings) || 0) + Math.abs(Number(s.amount));
        await m.save();
        restoredSavings += Math.abs(Number(s.amount));
      }
    }
  }
  console.log(`💰 Restored UGX ${restoredSavings.toLocaleString()} to member savings`);

  // 3. Compute total added to Account 1000
  const totalAdded = consSavings.reduce((s, x) => s + Math.abs(Number(x.amount || 0)), 0);
  console.log(`💰 Total pushed into Account 1000: UGX ${totalAdded.toLocaleString()}`);

  // 4. Reduce Account 1000
  const acc1000 = await Account.findOne({ code: '1000' });
  if (acc1000) {
    const before = Number(acc1000.balance) || 0;
    acc1000.balance = Math.max(0, before - totalAdded);
    await acc1000.save();
    console.log(`🏦 Account 1000: ${before.toLocaleString()} → ${acc1000.balance.toLocaleString()}`);
  }

  // 5. Delete constitution saving records
  const delSavings = await Saving.deleteMany({ category: 'constitution' });
  console.log(`🗑  Deleted ${delSavings.deletedCount} saving records`);

  // 6. Delete related journal entries
  const delJournals = await JournalEntry.deleteMany({
    description: { $regex: /constitution/i }
  });
  console.log(`🗑  Deleted ${delJournals.deletedCount} journal entries`);

  // 7. Delete constitution receipts
  const delReceipts = await Receipt.deleteMany({ type: 'constitution_fee' });
  console.log(`🗑  Deleted ${delReceipts.deletedCount} receipts`);

  // 8. Reset every member's constitution fields
  const resetMembers = await Member.updateMany({}, {
    $set: {
      constitutionPaid: false,
      constitutionPaidDate: null,
      constitutionPaidAmount: 0
    }
  });
  console.log(`🔄 Reset ${resetMembers.modifiedCount} members`);

  console.log('\n✅ Cleanup complete. Start the backend with: node app.js');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(e => {
  console.error('❌ Cleanup error:', e);
  process.exit(1);
});