const Saving = require('../models/Saving');
const Withdrawal = require('../models/Withdrawal');
const Loan = require('../models/Loan');
const Repayment = require('../models/Repayment');
const Dividend = require('../models/Dividend');
const ClubExpense = require('../models/ClubExpense');
const BusinessTransaction = require('../models/BusinessTransaction');
const Member = require('../models/Member');
const Account = require('../models/Account');
const Receipt = require('../models/Receipt');
const { createJournalEntry } = require('../utils/journalHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== GET ALL TRANSACTIONS (unified ledger) ====================
exports.getAllTransactions = async (req, res) => {
  try {
    const { memberId, type, direction, startDate, endDate, search } = req.query;

    const fromDate = startDate ? new Date(startDate) : new Date('2000-01-01');
    const toDate = endDate ? new Date(endDate) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const dateFilter = { $gte: fromDate, $lte: toDate };
    const entries = [];

    // ---- SAVINGS (all categories) ----
    const savingsFilter = { date: dateFilter };
    if (memberId) savingsFilter.memberId = memberId;
    const savings = await Saving.find(savingsFilter).populate('memberId', 'firstName surname memberNumber');
    for (const s of savings) {
      entries.push({
        _id: s._id,
        date: s.date,
        memberId: s.memberId?._id || null,
        memberName: s.memberId ? `${s.memberId.firstName} ${s.memberId.surname}` : (s.donorName || (s.category === 'donation' ? 'Anonymous' : 'Club')),
        memberNumber: s.memberId?.memberNumber || '',
        type: 'savings',
        category: s.category,
        description: s.description || s.category,
        amount: Number(s.amount) || 0,
        direction: 'in',
        sourceModel: 'Saving',
        sourceId: s._id
      });
    }

    // ---- WITHDRAWALS ----
    const wFilter = { status: 'paid', paidDate: dateFilter };
    if (memberId) wFilter.memberId = memberId;
    const withdrawals = await Withdrawal.find(wFilter);
    for (const w of withdrawals) {
      entries.push({
        _id: w._id,
        date: w.paidDate || w.requestedDate,
        memberId: w.memberId,
        memberName: w.memberName,
        memberNumber: w.memberNumber,
        type: 'withdrawal',
        category: w.source,
        description: `Withdrawal (${w.source}, ${w.period})`,
        amount: Number(w.amount) || 0,
        direction: 'out',
        sourceModel: 'Withdrawal',
        sourceId: w._id
      });
    }

    // ---- LOAN DISBURSEMENTS ----
    const loanFilter = { disbursedDate: dateFilter };
    if (memberId) loanFilter.memberId = memberId;
    const loans = await Loan.find(loanFilter).populate('memberId', 'firstName surname memberNumber');
    for (const l of loans) {
      entries.push({
        _id: l._id,
        date: l.disbursedDate,
        memberId: l.memberId?._id || null,
        memberName: l.memberId ? `${l.memberId.firstName} ${l.memberId.surname}` : '—',
        memberNumber: l.memberId?.memberNumber || '',
        type: 'loan_disbursement',
        category: l.type,
        description: `${l.type} loan disbursed`,
        amount: Number(l.amount) || 0,
        direction: 'out',
        sourceModel: 'Loan',
        sourceId: l._id
      });
    }

    // ---- LOAN REPAYMENTS ----
    const loanIds = memberId ? (await Loan.find({ memberId }).select('_id')).map(x => x._id) : null;
    const repFilter = { status: 'paid', paidDate: dateFilter };
    if (loanIds) repFilter.loanId = { $in: loanIds };
    const repayments = await Repayment.find(repFilter).populate({
      path: 'loanId',
      populate: { path: 'memberId', select: 'firstName surname memberNumber' }
    });
    for (const r of repayments) {
      const loan = r.loanId;
      const member = loan?.memberId;
      entries.push({
        _id: r._id,
        date: r.paidDate,
        memberId: member?._id || null,
        memberName: member ? `${member.firstName} ${member.surname}` : '—',
        memberNumber: member?.memberNumber || '',
        type: 'loan_repayment',
        category: loan?.type || 'loan',
        description: `Installment #${r.installmentNumber}`,
        amount: Number(r.amountPaid || r.amountDue) || 0,
        direction: 'in',
        sourceModel: 'Repayment',
        sourceId: r._id
      });
    }

    // ---- DIVIDENDS ----
    const divFilter = { distributionDate: dateFilter };
    const dividends = await Dividend.find(divFilter);
    for (const d of dividends) {
      for (const dist of d.distributions || []) {
        if (Number(dist.totalAmount) <= 0) continue;
        if (memberId && String(dist.memberId) !== String(memberId)) continue;
        entries.push({
          _id: dist._id || `${d._id}-${dist.memberId}`,
          date: d.distributionDate,
          memberId: dist.memberId,
          memberName: dist.memberName || '—',
          memberNumber: dist.memberNumber || '',
          type: 'dividend',
          category: 'dividend',
          description: 'Dividend distribution',
          amount: Number(dist.totalAmount) || 0,
          direction: 'in',
          sourceModel: 'Dividend',
          sourceId: d._id,
          subId: dist.memberId
        });
      }
    }

    // ---- CLUB EXPENSES ----
    if (!memberId) {
      const expFilter = { date: dateFilter };
      const expenses = await ClubExpense.find(expFilter);
      for (const e of expenses) {
        entries.push({
          _id: e._id,
          date: e.date,
          memberId: null,
          memberName: 'Club',
          memberNumber: '',
          type: 'club_expense',
          category: e.category || 'general',
          description: e.description,
          amount: Number(e.amount) || 0,
          direction: 'out',
          sourceModel: 'ClubExpense',
          sourceId: e._id
        });
      }
    }

    // ---- BUSINESS TRANSACTIONS ----
    if (!memberId) {
      const bizFilter = { date: dateFilter };
      const bizTxns = await BusinessTransaction.find(bizFilter).populate('businessId', 'name');
      for (const b of bizTxns) {
        const isIn = ['revenue', 'capital_in', 'external_in', 'refund'].includes(b.type);
        entries.push({
          _id: b._id,
          date: b.date,
          memberId: null,
          memberName: b.businessId?.name || 'Business',
          memberNumber: '',
          type: 'business',
          category: b.type,
          description: b.description,
          amount: Number(b.amount) || 0,
          direction: isIn ? 'in' : 'out',
          sourceModel: 'BusinessTransaction',
          sourceId: b._id
        });
      }
    }

    // ---- FILTER: type ----
    let filtered = entries;
    if (type && type !== 'all') filtered = filtered.filter(e => e.type === type);
    if (direction && direction !== 'all') filtered = filtered.filter(e => e.direction === direction);

    // ---- FILTER: search ----
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.memberName || '').toLowerCase().includes(q) ||
        (e.memberNumber || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q)
      );
    }

    // ---- SORT ----
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // ---- TOTALS ----
    const totalIn = filtered.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
    const totalOut = filtered.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0);

    res.json({
      transactions: filtered,
      count: filtered.length,
      totalIn,
      totalOut,
      net: totalIn - totalOut
    });
  } catch (error) {
    console.error('GET ALL TRANSACTIONS ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== REVERSE A TRANSACTION ====================
// Creates a compensating record + journal, marks receipt cancelled,
// restores balances. Original is NOT deleted.
exports.reverseTransaction = async (req, res) => {
  try {
    const { sourceModel, sourceId, reason, reversedBy } = req.body;

    if (!sourceModel || !sourceId) {
      return res.status(400).json({ error: 'sourceModel and sourceId are required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for reversal is required' });
    }

    let result;

    switch (sourceModel) {
      case 'Saving':
        result = await reverseSaving(sourceId, reason, reversedBy);
        break;
      case 'Withdrawal':
        result = await reverseWithdrawal(sourceId, reason, reversedBy);
        break;
      case 'Repayment':
        result = await reverseRepayment(sourceId, reason, reversedBy);
        break;
      case 'ClubExpense':
        result = await reverseClubExpense(sourceId, reason, reversedBy);
        break;
      case 'BusinessTransaction':
        result = await reverseBusinessTransaction(sourceId, reason, reversedBy);
        break;
      case 'Loan':
        return res.status(400).json({
          error: 'Loan disbursements cannot be reversed here. Use the Reverse button on the Loans page instead.'
        });
      case 'Dividend':
        return res.status(400).json({
          error: 'Dividend distributions cannot be reversed individually. Reverse the entire distribution from the Dividends page.'
        });
      default:
        return res.status(400).json({ error: `Cannot reverse ${sourceModel}` });
    }

    res.json({
      success: true,
      message: `Transaction reversed. ${result.note || ''}`.trim(),
      ...result
    });
  } catch (error) {
    console.error('REVERSE ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== REVERSAL HELPERS ====================

async function reverseSaving(savingId, reason, reversedBy) {
  const saving = await Saving.findById(savingId);
  if (!saving) throw new Error('Saving not found');
  if (saving.reversed) throw new Error('Saving already reversed');

  const member = saving.memberId ? await Member.findById(saving.memberId) : null;

  // Reverse member savings (for monthly/extra)
  if (member && ['monthly', 'extra'].includes(saving.category)) {
    member.savings = Math.max(0, (Number(member.savings) || 0) - Number(saving.amount || 0));
    await member.save();
  }

  // Reverse shares
  if (member && saving.category === 'shares' && saving.shareType) {
    member.shares[saving.shareType] = Math.max(0, (member.shares[saving.shareType] || 0) - (saving.shareQuantity || 0));
    await member.save();
  }

  // Create compensating Saving (negative amount marked as reversal)
  const reversal = await Saving.create({
    memberId: saving.memberId,
    category: saving.category,
    amount: -Number(saving.amount || 0),
    description: `REVERSAL: ${saving.description || saving.category} — ${reason}`,
    donorName: saving.donorName,
    donationType: saving.donationType,
    membershipType: saving.membershipType,
    month: saving.month,
    shareType: saving.shareType,
    shareQuantity: -Number(saving.shareQuantity || 0),
    date: new Date(),
    reversed: true,
    reversalOf: saving._id,
    reversalReason: reason
  });

  // Mark original as reversed
  saving.reversed = true;
  saving.reversedAt = new Date();
  saving.reversalReason = reason;
  await saving.save();

  // Cancel associated receipt
  await Receipt.updateMany(
    { referenceId: saving._id, status: 'issued' },
    { status: 'cancelled', cancelledReason: `Saving reversed: ${reason}`, cancelledAt: new Date(), cancelledBy: reversedBy || 'admin' }
  );

  // Journal entry (reverse)
  try {
    await createJournalEntry({
      date: new Date(),
      description: `Reversal: saving ${saving.category} of ${fmt(saving.amount)} — ${reason}`,
      reference: saving._id.toString(),
      sourceType: 'savings',
      lines: [
        { accountCode: '1010', debit: Number(saving.amount || 0) },
        { accountCode: '1000', credit: Number(saving.amount || 0) }
      ],
      createdBy: reversedBy || 'admin'
    });
  } catch (e) { console.error('Reversal journal:', e.message); }

  return { reversal, note: `Reversal saving created.` };
}

async function reverseWithdrawal(withdrawalId, reason, reversedBy) {
  const w = await Withdrawal.findById(withdrawalId);
  if (!w) throw new Error('Withdrawal not found');
  if (w.status !== 'paid') throw new Error('Only paid withdrawals can be reversed');

  const member = await Member.findById(w.memberId);
  if (!member) throw new Error('Member not found');

  // Restore balance
  if (w.source === 'savings') {
    member.savings = (Number(member.savings) || 0) + Number(w.amount);
  } else if (w.source === 'dividends') {
    member.dividendBalance = (Number(member.dividendBalance) || 0) + Number(w.amount);
    member.totalDividendsWithdrawn = Math.max(0, (Number(member.totalDividendsWithdrawn) || 0) - Number(w.amount));
  }
  await member.save();

  w.status = 'cancelled';
  w.notes = `${w.notes || ''}\nREVERSED: ${reason}`.trim();
  await w.save();

  return { note: `Withdrawal cancelled, ${fmt(w.amount)} restored to ${w.source}.` };
}

async function reverseRepayment(repaymentId, reason, reversedBy) {
  const r = await Repayment.findById(repaymentId);
  if (!r) throw new Error('Repayment not found');
  if (r.status !== 'paid') throw new Error('Only paid repayments can be reversed');

  const loan = await Loan.findById(r.loanId);
  if (!loan) throw new Error('Loan not found');

  // Principal returns from Loan Fund → removed (since repayment is undone)
  const loanAcc = await Account.findOne({ code: '1100' });
  const interestAcc = await Account.findOne({ code: '1300' });

  const totalInstallments = await Repayment.countDocuments({ loanId: loan._id });
  const principalPortion = Number(loan.amount) / totalInstallments;
  const interestPortion = Math.max(0, Number(r.amountPaid || r.amountDue) - principalPortion);

  if (loanAcc) {
    loanAcc.balance = Math.max(0, (Number(loanAcc.balance) || 0) - principalPortion);
    await loanAcc.save();
  }
  if (interestAcc) {
    interestAcc.balance = Math.max(0, (Number(interestAcc.balance) || 0) - interestPortion);
    await interestAcc.save();
  }

  r.status = 'pending';
  r.amountPaid = 0;
  r.paidDate = null;
  await r.save();

  return { note: `Repayment #${r.installmentNumber} reversed to pending.` };
}

async function reverseClubExpense(expenseId, reason, reversedBy) {
  const e = await ClubExpense.findById(expenseId);
  if (!e) throw new Error('Expense not found');

  // Restore Club Capital
  const clubAcc = await Account.findOne({ code: '1000' });
  if (clubAcc) {
    clubAcc.balance = (Number(clubAcc.balance) || 0) + Number(e.amount);
    await clubAcc.save();
  }

  // Journal: reverse (credit Club Expenses, debit Club Capital)
  try {
    await createJournalEntry({
      date: new Date(),
      description: `Reversal: club expense ${e.description} — ${reason}`,
      sourceType: 'club_expense',
      lines: [
        { accountCode: '1000', debit: Number(e.amount) },
        { accountCode: '4010', credit: Number(e.amount) }
      ],
      createdBy: reversedBy || 'admin'
    });
  } catch (err) { console.error('Reversal journal:', err.message); }

  await ClubExpense.findByIdAndDelete(expenseId);

  return { note: `Club expense of ${fmt(e.amount)} reversed.` };
}

async function reverseBusinessTransaction(txnId, reason, reversedBy) {
  const txn = await BusinessTransaction.findById(txnId);
  if (!txn) throw new Error('Business transaction not found');

  const isIn = ['revenue', 'capital_in', 'external_in', 'refund'].includes(txn.type);

  // Restore/remove from business balance
  const Business = require('../models/Business');
  const biz = await Business.findById(txn.businessId);
  if (biz) {
    if (isIn) {
      biz.currentBalance = Math.max(0, (Number(biz.currentBalance) || 0) - Number(txn.amount));
    } else {
      biz.currentBalance = (Number(biz.currentBalance) || 0) + Number(txn.amount);
    }
    await biz.save();
  }

  // Journal
  try {
    await createJournalEntry({
      date: new Date(),
      description: `Reversal: business ${txn.type} of ${fmt(txn.amount)} — ${reason}`,
      sourceType: 'business',
      lines: [
        { accountCode: '1000', debit: Number(txn.amount) },
        { accountCode: biz?.fundAccountCode || '1100', credit: Number(txn.amount) }
      ],
      createdBy: reversedBy || 'admin'
    });
  } catch (e) { console.error('Reversal journal:', e.message); }

  await BusinessTransaction.findByIdAndDelete(txnId);

  return { note: `Business transaction of ${fmt(txn.amount)} reversed.` };
}

// ==================== GET SINGLE TRANSACTION DETAIL ====================
exports.getTransactionDetail = async (req, res) => {
  try {
    const { sourceModel, sourceId } = req.params;

    let record = null;

    if (sourceModel === 'Saving') record = await Saving.findById(sourceId).populate('memberId', 'firstName surname memberNumber');
    else if (sourceModel === 'Withdrawal') record = await Withdrawal.findById(sourceId);
    else if (sourceModel === 'Loan') record = await Loan.findById(sourceId).populate('memberId', 'firstName surname memberNumber');
    else if (sourceModel === 'Repayment') record = await Repayment.findById(sourceId);
    else if (sourceModel === 'ClubExpense') record = await ClubExpense.findById(sourceId);
    else if (sourceModel === 'BusinessTransaction') record = await BusinessTransaction.findById(sourceId);

    if (!record) return res.status(404).json({ error: 'Transaction not found' });

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};