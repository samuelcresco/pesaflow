const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');

// Generate unique entry number
async function generateEntryNumber() {
  const count = await JournalEntry.countDocuments();
  const num = String(count + 1).padStart(6, '0');
  const year = new Date().getFullYear();
  return `JE-${year}-${num}`;
}

// Create a balanced journal entry (records only — does NOT touch account balances)
async function createJournalEntry({ date, description, reference, sourceType, lines, createdBy }) {
  // Validate balance
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: Debit ${totalDebit} ≠ Credit ${totalCredit}`);
  }

  const entryNumber = await generateEntryNumber();

  // Enrich lines with account names (fetch only, don't modify balances)
  const enrichedLines = [];
  for (const line of lines) {
    const account = await Account.findOne({ code: line.accountCode });
    enrichedLines.push({
      accountCode: line.accountCode,
      accountName: account ? account.name : line.accountName || 'Unknown',
      debit: line.debit || 0,
      credit: line.credit || 0
    });
  }

  const entry = await JournalEntry.create({
    entryNumber,
    date,
    description,
    reference,
    sourceType,
    lines: enrichedLines,
    totalDebit,
    totalCredit,
    createdBy
  });

  return entry;
}

module.exports = { createJournalEntry, generateEntryNumber };