/**
 * Setup / verify the club chart of accounts.
 *
 * Creates the payment-channel asset accounts (Cash, Bank, Mobile Money).
 * Ensures 1010 (Member Savings) is a Liability header with 0 balance.
 *
 * SAFE TO RE-RUN ANY TIME — including after a full data wipe.
 * Idempotent: only creates accounts that are missing, always retags + zeroes 1010.
 *
 * USAGE:
 *   node utils/setupAccountChart.js            → dry run (reports plan)
 *   node utils/setupAccountChart.js --commit   → actually applies
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('../models/Account');

const COMMIT = process.argv.includes('--commit');

// ── Accounts to ensure ──
const REQUIRED_ACCOUNTS = [
  { code: '1001', name: 'Cash on Hand', type: 'Asset', description: 'Physical cash held by the club' },
  { code: '1002', name: 'Bank Account', type: 'Asset', description: 'Club bank account' },
  { code: '1003', name: 'Mobile Money', type: 'Asset', description: 'Club MTN / Airtel Money' },
  { code: '1010', name: 'Member Savings', type: 'Liability', description: 'Header account for per-member savings ledgers (2005001+)' }
];

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log(`  SETUP ACCOUNT CHART — ${COMMIT ? 'COMMIT MODE' : 'DRY RUN'}`);
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pesaflow');
  console.log(`✓ Connected to ${mongoose.connection.name}\n`);

  const plan = { create: [], retag: [], zero: [], ok: [] };

  for (const spec of REQUIRED_ACCOUNTS) {
    const existing = await Account.findOne({ code: spec.code });

    if (!existing) {
      plan.create.push(spec);
      continue;
    }

    const needsRetag = existing.type !== spec.type;
    const needsZero = spec.code === '1010' && Number(existing.balance || 0) !== 0;

    if (needsRetag || needsZero) {
      plan.retag.push({
        code: spec.code,
        fromType: existing.type,
        toType: spec.type,
        needsRetag,
        currentBalance: Number(existing.balance || 0),
        needsZero
      });
    } else {
      plan.ok.push(spec.code);
    }
  }

  // ── Report the plan ──
  console.log('── PLAN ──\n');

  if (plan.create.length > 0) {
    console.log(`CREATE (${plan.create.length}):`);
    plan.create.forEach(a => console.log(`  + ${a.code}  ${a.name.padEnd(20)} ${a.type}`));
    console.log('');
  }

  if (plan.retag.length > 0) {
    console.log(`UPDATE (${plan.retag.length}):`);
    plan.retag.forEach(r => {
      const bits = [];
      if (r.needsRetag) bits.push(`type ${r.fromType} → ${r.toType}`);
      if (r.needsZero) bits.push(`balance ${r.currentBalance.toLocaleString()} → 0`);
      console.log(`  ~ ${r.code}  ${bits.join('   |   ')}`);
    });
    console.log('');
  }

  if (plan.ok.length > 0) {
    console.log(`OK (already correct): ${plan.ok.join(', ')}\n`);
  }

  if (!COMMIT) {
    console.log('─────────────────────────────────────────────────');
    console.log('  DRY RUN — nothing written.');
    console.log('  Re-run with  --commit  to apply.\n');
    await mongoose.disconnect();
    return;
  }

  // ── Apply ──
  console.log('── APPLYING ──\n');

  for (const spec of REQUIRED_ACCOUNTS) {
    let acc = await Account.findOne({ code: spec.code });

    if (!acc) {
      try {
        await Account.create({
          code: spec.code,
          name: spec.name,
          type: spec.type,
          balance: 0,
          description: spec.description || ''
        });
        console.log(`  ✓ Created ${spec.code}  ${spec.name} (${spec.type})`);
      } catch (err) {
        console.error(`  ✗ Failed to create ${spec.code}: ${err.message}`);
      }
      continue;
    }

    let changed = false;
    if (acc.type !== spec.type) {
      console.log(`  ~ ${spec.code}  type ${acc.type} → ${spec.type}`);
      acc.type = spec.type;
      changed = true;
    }
    if (spec.code === '1010' && Number(acc.balance || 0) !== 0) {
      console.log(`  ~ ${spec.code}  balance ${Number(acc.balance).toLocaleString()} → 0`);
      acc.balance = 0;
      changed = true;
    }
    if (changed) await acc.save();
  }

  // ── Verify ──
  console.log('\n── VERIFY ──\n');
  const final = await Account.find({ code: { $in: REQUIRED_ACCOUNTS.map(a => a.code) } }).sort('code').lean();
  final.forEach(a => {
    console.log(`  ${a.code}  ${String(a.type).padEnd(10)}  ${String(Number(a.balance || 0).toLocaleString()).padStart(12)}  ${a.name}`);
  });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});