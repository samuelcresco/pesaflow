const Saving = require('../models/Saving');
const Member = require('../models/Member');
const BulkBatch = require('../models/BulkBatch');
const Account = require('../models/Account');
const Receipt = require('../models/Receipt');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { getMemberAccountCode, ensureMemberAccount } = require('../utils/memberAccountHelper');
const { writeMemberSavingsJournal } = require('../utils/journalHelper');

const MISC_ACCOUNT_CODE = '1060';
const PAYMENT_METHODS = ['cash', 'bank', 'mobile_money'];

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

async function bumpMiscAccount(delta) {
  try {
    let acc = await Account.findOne({ code: MISC_ACCOUNT_CODE });
    if (!acc) {
      acc = await Account.create({
        code: MISC_ACCOUNT_CODE,
        name: 'miscellaneous',
        type: 'Equity',
        balance: Math.max(0, Number(delta) || 0)
      });
    } else {
      acc.balance = Math.max(0, (Number(acc.balance) || 0) + Number(delta || 0));
      await acc.save();
    }
    return acc.balance;
  } catch (err) {
    console.error('Bulk misc account bump error:', err.message);
    return null;
  }
}

async function makeReceipt({ category, member, amount, description, savingId, date, paymentMethod }) {
  try {
    const receiptNumber = await generateReceiptNumber(new Date(date));
    const typeMap = { monthly: 'savings_deposit', misc: 'savings_deposit' };
    await Receipt.create({
      receiptNumber,
      type: typeMap[category] || 'savings_deposit',
      memberId: member._id,
      memberName: `${member.firstName} ${member.surname}`,
      memberNumber: member.memberNumber,
      amount: Number(amount) || 0,
      description: description || `Bulk ${category} savings`,
      category,
      referenceId: savingId,
      referenceModel: 'Saving',
      referenceNumber: savingId ? String(savingId).slice(-8) : '',
      date: new Date(date),
      issuedBy: 'admin',
      issuedByName: '',
      paymentMethod: paymentMethod || 'cash'
    });
  } catch (err) {
    console.error('Bulk receipt error:', err.message);
  }
}

// ── Normalize + validate input ──
function parseBulkInput(body) {
  const {
    category, mode, memberId, scope, month, year, amount, description, paymentMethod
  } = body;

  if (!['monthly', 'misc'].includes(category)) throw new Error('category must be monthly or misc');
  if (!['single', 'all'].includes(mode)) throw new Error('mode must be single or all');
  if (!['month', 'year'].includes(scope)) throw new Error('scope must be month or year');

  const y = Number(year);
  if (!y || y < 2015 || y > 2100) throw new Error('Invalid year');

  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error('Invalid amount');

  const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'cash';

  let months;
  if (scope === 'month') {
    const m = Number(month);
    if (!m || m < 1 || m > 12) throw new Error('Invalid month');
    months = [m];
  } else {
    months = Array.from({ length: 12 }, (_, i) => i + 1);
  }

  if (mode === 'single' && !memberId) throw new Error('memberId required for single mode');

  return {
    category,
    mode,
    memberId: memberId || null,
    scope,
    months,
    year: y,
    amount: amt,
    description: description || '',
    paymentMethod: method
  };
}

async function loadMembers(input) {
  if (input.mode === 'single') {
    const m = await Member.findById(input.memberId);
    if (!m) throw new Error('Member not found');
    return [m];
  }
  return await Member.find({ active: { $ne: false } });
}

// ═══════════════════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════════════════
exports.previewBulk = async (req, res) => {
  try {
    const input = parseBulkInput(req.body);
    const members = await loadMembers(input);

    const details = [];
    let willCreate = 0, willOverwrite = 0, totalNewAmount = 0, totalPreviousAmount = 0;

    for (const member of members) {
      for (const m of input.months) {
        const { start, end } = monthRange(m, input.year);
        const existing = await Saving.find({
          category: input.category,
          memberId: member._id,
          date: { $gte: start, $lt: end }
        });
        const existingAmt = existing.reduce((s, x) => s + Number(x.amount || 0), 0);

        if (existing.length > 0) {
          willOverwrite++;
          totalPreviousAmount += existingAmt;
        } else {
          willCreate++;
        }
        totalNewAmount += input.amount;

        details.push({
          memberId: member._id,
          memberName: `${member.firstName} ${member.surname}`,
          memberNumber: member.memberNumber,
          month: m,
          year: input.year,
          existingAmount: existingAmt,
          willOverwrite: existing.length > 0
        });
      }
    }

    const totalRecords = members.length * input.months.length;
    const estimatedSeconds = Math.ceil(totalRecords * 0.12);

    res.json({
      category: input.category,
      mode: input.mode,
      scope: input.scope,
      months: input.months,
      year: input.year,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      membersAffected: members.length,
      monthsAffected: input.months.length,
      totalRecords,
      willCreate,
      willOverwrite,
      totalNewAmount,
      totalPreviousAmount,
      netChange: totalNewAmount - totalPreviousAmount,
      estimatedSeconds,
      warning: totalRecords > 200 ? `This run will create ${totalRecords} records and may take ${estimatedSeconds}s. Consider splitting into monthly runs.` : null,
      details
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// COMMIT
// ═══════════════════════════════════════════════════════════
exports.commitBulk = async (req, res) => {
  try {
    const input = parseBulkInput(req.body);
    const members = await loadMembers(input);
    if (members.length === 0) return res.status(400).json({ error: 'No members' });

    const appliedTo = [];
    let createdCount = 0, overwrittenCount = 0, totalAmount = 0;
    const errors = [];

    for (const member of members) {
      for (const monthNum of input.months) {
        const { start, end } = monthRange(monthNum, input.year);
        const monthLabel = `${String(monthNum).padStart(2, '0')}/${input.year}`;

        try {
          const existing = await Saving.find({
            category: input.category,
            memberId: member._id,
            date: { $gte: start, $lt: end }
          });

          // Reverse previous effects
          for (const s of existing) {
            if (input.category === 'monthly') {
              member.savings = Math.max(0, (Number(member.savings) || 0) - Number(s.amount || 0));
              await member.save();

              try {
                const code = getMemberAccountCode(member.memberNumber);
                if (code) {
                  await writeMemberSavingsJournal({
                    memberAccountCode: code,
                    memberAccountName: `Member Savings — ${member.firstName} ${member.surname} (${member.memberNumber})`,
                    amount: Number(s.amount || 0),
                    direction: 'withdrawal',
                    date: new Date(),
                    description: `Bulk overwrite reversal — ${s.category} ${monthLabel}`,
                    sourceType: 'bulk_reverse',
                    paymentMethod: s.paymentMethod || input.paymentMethod
                  });
                }
              } catch (e) { console.error('reverse journal err', e.message); }
            }
            if (input.category === 'misc') {
              await bumpMiscAccount(-Number(s.amount || 0));
            }
          }

          if (existing.length > 0) {
            await Saving.deleteMany({ _id: { $in: existing.map(s => s._id) } });
          }

          // Create new saving
          const newSaving = new Saving({
            memberId: member._id,
            category: input.category,
            amount: input.amount,
            description: input.description || `Bulk ${input.category} — ${monthLabel}`,
            month: `${input.year}-${String(monthNum).padStart(2, '0')}`,
            date: new Date(input.year, monthNum - 1, 15, 12, 0, 0),
            paymentMethod: input.paymentMethod
          });
          await newSaving.save();

          // Apply effects + journal
          if (input.category === 'monthly') {
            member.savings = (Number(member.savings) || 0) + input.amount;
            await member.save();

            try {
              const code = getMemberAccountCode(member.memberNumber);
              if (code) {
                await ensureMemberAccount(member);
                await writeMemberSavingsJournal({
                  memberAccountCode: code,
                  memberAccountName: `Member Savings — ${member.firstName} ${member.surname} (${member.memberNumber})`,
                  amount: input.amount,
                  direction: 'deposit',
                  date: newSaving.date,
                  description: `Bulk monthly — ${member.firstName} ${member.surname} — ${monthLabel}`,
                  sourceType: 'bulk_saving_monthly',
                  paymentMethod: input.paymentMethod
                });
              }
            } catch (e) { console.error('bulk journal err', e.message); }
          }
          if (input.category === 'misc') {
            await bumpMiscAccount(input.amount);
          }

          await makeReceipt({
            category: input.category,
            member,
            amount: input.amount,
            description: input.description || `Bulk ${input.category} — ${monthLabel}`,
            savingId: newSaving._id,
            date: newSaving.date,
            paymentMethod: input.paymentMethod
          });

          appliedTo.push({
            memberId: member._id,
            memberName: `${member.firstName} ${member.surname}`,
            memberNumber: member.memberNumber,
            month: monthNum,
            year: input.year,
            savingId: newSaving._id,
            previousSavingIds: existing.map(s => s._id),
            previousAmount: existing.reduce((s, x) => s + Number(x.amount || 0), 0)
          });

          createdCount++;
          if (existing.length > 0) overwrittenCount++;
          totalAmount += input.amount;
        } catch (innerErr) {
          errors.push({
            member: `${member.firstName} ${member.surname}`,
            memberNumber: member.memberNumber,
            month: monthNum,
            error: innerErr.message
          });
        }
      }
    }

    const batch = await BulkBatch.create({
      category: input.category,
      mode: input.mode,
      scope: input.scope,
      month: input.scope === 'month' ? input.months[0] : null,
      year: input.year,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description,
      appliedTo,
      createdCount,
      overwrittenCount,
      totalAmount,
      createdBy: req.body.createdBy || 'admin'
    });

    res.json({
      success: true,
      batchId: batch._id,
      category: input.category,
      mode: input.mode,
      scope: input.scope,
      months: input.months,
      year: input.year,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      membersAffected: members.length,
      createdCount,
      overwrittenCount,
      totalAmount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('commitBulk error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════
exports.listBatches = async (req, res) => {
  try {
    const batches = await BulkBatch.find().sort('-createdAt').limit(100);
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════
// REVERSE
// ═══════════════════════════════════════════════════════════
// NOTE: Reversal removes the records this batch created and reverses
// their effects. It does NOT restore records that were overwritten
// during the original commit — those are gone permanently.
exports.reverseBatch = async (req, res) => {
  try {
    const batch = await BulkBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.reversed) return res.status(400).json({ error: 'Batch already reversed' });

    const savingIds = batch.appliedTo.map(a => a.savingId).filter(Boolean);
    const savings = await Saving.find({ _id: { $in: savingIds } });

    const reversedSavingIds = [];
    const errors = [];

    for (const s of savings) {
      try {
        if (batch.category === 'monthly' && s.memberId) {
          const mem = await Member.findById(s.memberId);
          if (mem) {
            mem.savings = Math.max(0, (Number(mem.savings) || 0) - Number(s.amount || 0));
            await mem.save();

            const code = getMemberAccountCode(mem.memberNumber);
            if (code) {
              try {
                await writeMemberSavingsJournal({
                  memberAccountCode: code,
                  memberAccountName: `Member Savings — ${mem.firstName} ${mem.surname} (${mem.memberNumber})`,
                  amount: Number(s.amount || 0),
                  direction: 'withdrawal',
                  date: new Date(),
                  description: `Batch reversal — ${batch.referenceNumber || batch._id} — ${s.category}`,
                  sourceType: 'batch_reverse',
                  paymentMethod: batch.paymentMethod || 'cash'
                });
              } catch (e) { console.error('reverse journal error', e.message); }
            }
          }
        }
        if (batch.category === 'misc') {
          await bumpMiscAccount(-Number(s.amount || 0));
        }
        reversedSavingIds.push(s._id);
      } catch (e) {
        errors.push({ savingId: s._id, error: e.message });
      }
    }

    if (reversedSavingIds.length > 0) {
      await Saving.deleteMany({ _id: { $in: reversedSavingIds } });
    }

    batch.reversed = true;
    batch.reversedAt = new Date();
    batch.reversedBy = req.body.reversedBy || 'admin';
    batch.reversalNotes = req.body.reversalNotes || '';
    await batch.save();

    res.json({
      success: true,
      reversedCount: reversedSavingIds.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      batchId: batch._id,
      note: 'Reversal removes batch records. Previously overwritten records were permanently deleted at commit time and are NOT restored.'
    });
  } catch (err) {
    console.error('reverseBatch error:', err.message);
    res.status(500).json({ error: err.message });
  }
};