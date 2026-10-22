/**
 * One-time backfill script: create a Liability account for every member.
 *
 * USAGE:
 *   node utils/backfillMemberAccounts.js            → dry run (reports, no writes)
 *   node utils/backfillMemberAccounts.js --commit   → actually creates accounts
 *
 * Safe to re-run: existing accounts are skipped (idempotent).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Member = require('../models/Member');
const Account = require('../models/Account');
const { getMemberAccountCode, ensureMemberAccount } = require('./memberAccountHelper');

const COMMIT = process.argv.includes('--commit');

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log(`  BACKFILL MEMBER ACCOUNTS — ${COMMIT ? 'COMMIT MODE' : 'DRY RUN'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pesaflow';
  await mongoose.connect(uri);
  console.log(`✓ Connected to ${mongoose.connection.name}\n`);

  const members = await Member.find().sort('memberNumber');
  console.log(`Found ${members.length} members in the database.\n`);

  const results = {
    create: [],
    skip: [],
    badFormat: [],
    collision: [],
    error: []
  };

  for (const member of members) {
    const fullName = `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unnamed';
    const label = `${member.memberNumber || '(no number)'} — ${fullName}`;

    const code = getMemberAccountCode(member.memberNumber);
    if (!code) {
      results.badFormat.push({ label, memberNumber: member.memberNumber });
      continue;
    }

    const existing = await Account.findOne({ code });
    if (existing) {
      // Guard: existing account with a different member name = collision
      if (existing.name && !existing.name.includes(member.memberNumber || '__')) {
        results.collision.push({ label, code, existingName: existing.name });
        continue;
      }
      results.skip.push({ label, code });
      continue;
    }

    if (!COMMIT) {
      results.create.push({ label, code, wouldCreateName: `Member Savings — ${fullName} (${member.memberNumber})` });
      continue;
    }

    try {
      const account = await ensureMemberAccount(member);
      results.create.push({ label, code, accountId: String(account._id) });
    } catch (err) {
      results.error.push({ label, code, error: err.message });
    }
  }

  // ── Report ──
  console.log('─────────────────────────────────────────────────────');
  console.log('  RESULT');
  console.log('─────────────────────────────────────────────────────\n');

  console.log(`✓ ${COMMIT ? 'Created' : 'Would create'}: ${results.create.length}`);
  if (results.create.length > 0) {
    results.create.forEach(r => console.log(`     ${r.code.padEnd(12)} ${r.label}`));
    console.log('');
  }

  console.log(`⏭  Already exists (skipped): ${results.skip.length}`);
  if (results.skip.length > 0 && results.skip.length <= 20) {
    results.skip.forEach(r => console.log(`     ${r.code.padEnd(12)} ${r.label}`));
    console.log('');
  } else if (results.skip.length > 20) {
    console.log(`     (${results.skip.length} accounts already exist — not showing full list)\n`);
  }

  if (results.badFormat.length > 0) {
    console.log(`⚠  Bad member number format: ${results.badFormat.length}`);
    results.badFormat.forEach(r => console.log(`     ${r.label}`));
    console.log('');
  }

  if (results.collision.length > 0) {
    console.log(`⚠  Code collision (existing account belongs to different member): ${results.collision.length}`);
    results.collision.forEach(r => console.log(`     ${r.code.padEnd(12)} ${r.label}  ← existing: "${r.existingName}"`));
    console.log('');
  }

  if (results.error.length > 0) {
    console.log(`❌ Errors: ${results.error.length}`);
    results.error.forEach(r => console.log(`     ${r.code.padEnd(12)} ${r.label}  — ${r.error}`));
    console.log('');
  }

  console.log('─────────────────────────────────────────────────────');
  if (!COMMIT) {
    console.log('  DRY RUN — nothing was written.');
    console.log('  Re-run with  --commit  to actually create accounts.');
  } else {
    console.log('  DONE. Accounts created: ' + results.create.length);
  }
  console.log('─────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(results.error.length > 0 || results.collision.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});