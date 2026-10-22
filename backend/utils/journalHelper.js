const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');

// Payment method → asset account
const PAYMENT_ACCOUNTS = {
  cash: { code: '1001', name: 'Cash on Hand' },
  bank: { code: '1002', name: 'Bank Account' },
  mobile_money: { code: '1003', name: 'Mobile Money' }
};

async function ensurePaymentAccounts() {
  for (const key of Object.keys(PAYMENT_ACCOUNTS)) {
    const spec = PAYMENT_ACCOUNTS[key];
    const exists = await Account.findOne({ code: spec.code });
    if (!exists) {
      try {
        await Account.create({ code: spec.code, name: spec.name, type: 'Asset', balance: 0 });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
  }
}

async function nextEntryNumber(date) {
  const year = (date ? new Date(date) : new Date()).getFullYear();
  const prefix = `JE-${year}-`;

  const last = await JournalEntry
    .findOne({ entryNumber: new RegExp(`^${prefix}`) })
    .sort({ entryNumber: -1 })
    .select('entryNumber')
    .lean();

  let next = 1;
  if (last && last.entryNumber) {
    const seq = parseInt(String(last.entryNumber).replace(prefix, ''), 10);
    if (!isNaN(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

async function writeJournal({ date, description, sourceType, lines, createdBy }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('Journal must have at least one line');

  let debitSum = 0, creditSum = 0;
  for (const l of lines) {
    debitSum += Number(l.debit || 0);
    creditSum += Number(l.credit || 0);
  }
  if (Math.abs(debitSum - creditSum) > 0.01) {
    throw new Error(`Journal not balanced: debit ${debitSum} ≠ credit ${creditSum}`);
  }

  const payload = {
    date: date ? new Date(date) : new Date(),
    description: description || '',
    sourceType: sourceType || 'manual',
    lines: lines.map(l => ({
      accountCode: String(l.accountCode),
      accountName: l.accountName || '',
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0)
    }))
  };
  if (createdBy) payload.createdBy = createdBy;

  let entry = null, attempts = 0;
  while (!entry && attempts < 5) {
    attempts++;
    payload.entryNumber = await nextEntryNumber(payload.date);
    try {
      entry = await JournalEntry.create(payload);
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  if (!entry) throw new Error('Could not generate unique entry number after 5 attempts');
  return entry;
}

/**
 * Write member-savings journal.
 * 
 * direction='deposit'   → Debit payment account, Credit member  (money in)
 * direction='withdrawal' → Debit member, Credit payment account (money out)
 * 
 * paymentMethod: 'cash' | 'bank' | 'mobile_money' (defaults to 'cash')
 */
async function writeMemberSavingsJournal({
  memberAccountCode,
  memberAccountName,
  amount,
  direction,
  date,
  description,
  sourceType,
  paymentMethod = 'cash'
}) {
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error('Amount must be positive');
  if (!memberAccountCode) throw new Error('memberAccountCode is required');
  if (!['deposit', 'withdrawal'].includes(direction)) {
    throw new Error('direction must be "deposit" or "withdrawal"');
  }

  const pay = PAYMENT_ACCOUNTS[paymentMethod];
  if (!pay) {
    throw new Error(`Unknown paymentMethod "${paymentMethod}". Use: ${Object.keys(PAYMENT_ACCOUNTS).join(', ')}`);
  }

  await ensurePaymentAccounts();

  const memberLine = {
    accountCode: String(memberAccountCode),
    accountName: memberAccountName || 'Member Savings',
    debit: direction === 'withdrawal' ? amt : 0,
    credit: direction === 'deposit' ? amt : 0
  };

  const payLine = {
    accountCode: pay.code,
    accountName: pay.name,
    debit: direction === 'deposit' ? amt : 0,
    credit: direction === 'withdrawal' ? amt : 0
  };

  return writeJournal({
    date,
    description,
    sourceType: sourceType || 'saving',
    lines: [payLine, memberLine]
  });
}

module.exports = {
  writeJournal,
  writeMemberSavingsJournal,
  ensurePaymentAccounts,
  PAYMENT_ACCOUNTS
};