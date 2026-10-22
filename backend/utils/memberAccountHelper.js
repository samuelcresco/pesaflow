const Account = require('../models/Account');

/**
 * Derive a member's ledger account code from their member number.
 * 
 *   CRS2005/001   → 2005001
 *   CRS2024/015   → 2024015
 *   CRS2005/100   → 2005100
 *   2005/001      → 2005001   (works without prefix too)
 *   CRS-2005-001  → 2005001   (dash separator works)
 *   CRS 2005 001  → 2005001   (spaces work)
 * 
 * Returns null if the member number doesn't contain at least two digit groups.
 */
function getMemberAccountCode(memberNumber) {
  if (!memberNumber || typeof memberNumber !== 'string') return null;

  const digits = memberNumber.trim().match(/\d+/g);
  if (!digits || digits.length < 2) return null;

  const year = digits[0];
  const rawSeq = digits[1];

  // Ensure the sequence is at least 3 digits so codes sort consistently
  const seq = rawSeq.length < 3 ? rawSeq.padStart(3, '0') : rawSeq;

  return `${year}${seq}`;
}

/**
 * Ensure a member has a Liability account in the chart of accounts.
 * Creates the account on first call. Idempotent — safe to call repeatedly.
 * 
 * If an account with the derived code already exists:
 *   - returns it (as long as it looks like it belongs to this member)
 *   - throws if the existing account belongs to a different member (data integrity guard)
 * 
 * Returns the Account document.
 */
async function ensureMemberAccount(member) {
  if (!member) throw new Error('Member is required');
  if (!member._id) throw new Error('Member must have an _id');
  if (!member.memberNumber) throw new Error('Member must have a memberNumber');

  const code = getMemberAccountCode(member.memberNumber);
  if (!code) {
    throw new Error(
      `Cannot derive account code from member number "${member.memberNumber}". ` +
      `Expected a number containing at least two digit groups (e.g. CRS2005/001).`
    );
  }

  const fullName = `${member.firstName || ''} ${member.surname || ''}`.trim() || 'Unnamed Member';
  const accountName = `Member Savings — ${fullName} (${member.memberNumber})`;

  let account = await Account.findOne({ code });

  if (account) {
    // Guard against code collisions with a different member
    if (account.name && !account.name.includes(member.memberNumber)) {
      throw new Error(
        `Account code ${code} already exists and belongs to a different member: "${account.name}". ` +
        `Member number ${member.memberNumber} cannot use this code.`
      );
    }
    return account;
  }

  try {
    account = await Account.create({
      code,
      name: accountName,
      type: 'Liability',
      balance: 0
    });
    return account;
  } catch (err) {
    // Duplicate key race — another request created it a moment ago. Fetch and return.
    if (err.code === 11000) {
      const existing = await Account.findOne({ code });
      if (existing) return existing;
    }
    throw err;
  }
}

module.exports = { getMemberAccountCode, ensureMemberAccount };