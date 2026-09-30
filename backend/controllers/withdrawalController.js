const Withdrawal = require('../models/Withdrawal');
const Member = require('../models/Member');
const Receipt = require('../models/Receipt');
const WithdrawalSettings = require('../models/WithdrawalSettings');
const {
  checkEligibility,
  isWithinWindow,
  getWithdrawalWindow,
  getSettings,
  getWindowLabel
} = require('../utils/withdrawalHelper');
const { generateReceiptNumber } = require('../utils/receiptNumber');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== SETTINGS ====================
exports.getWithdrawalSettings = async (req, res) => {
  try {
    const s = await getSettings();
    res.json(s);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateWithdrawalSettings = async (req, res) => {
  try {
    let s = await WithdrawalSettings.findOne();
    if (!s) s = new WithdrawalSettings();

    const fields = [
      'juneEnabled', 'juneStartDay', 'juneEndDay',
      'decemberEnabled', 'decemberStartDay', 'decemberEndDay',
      'savingsCapPercent', 'blockOnActiveLoan', 'allowOverride',
      'updatedBy'
    ];
    fields.forEach(f => {
      if (req.body[f] !== undefined) s[f] = req.body[f];
    });

    await s.save();
    res.json({ success: true, settings: s });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== CHECK ELIGIBILITY ====================
exports.checkMemberEligibility = async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const source = req.query.source || 'savings';
    const amount = Number(req.query.amount) || 0;

    const settings = await getSettings();
    const window = isWithinWindow(new Date(), settings);
    const eligibility = checkEligibility(member, source, amount, new Date(), settings);

    res.json({
      memberId: member._id,
      memberNumber: member.memberNumber,
      memberName: `${member.firstName} ${member.surname}`,
      savings: Number(member.savings) || 0,
      dividendBalance: Number(member.dividendBalance) || 0,
      lockedSavings: Number(member.lockedSavings) || 0,
      hasActiveLoan: !!member.activeLoanId,
      window,
      eligibility,
      withdrawalWindow: getWithdrawalWindow(new Date(), settings),
      windowLabel: getWindowLabel(settings),
      allowOverride: settings.allowOverride,
      savingsCapPercent: settings.savingsCapPercent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REQUEST WITHDRAWAL ====================
exports.requestWithdrawal = async (req, res) => {
  try {
    const { memberId, source, amount, notes, requestedBy, overrideReason } = req.body;

    if (!memberId) return res.status(400).json({ error: 'Member is required' });
    if (!source || !['savings', 'dividends'].includes(source)) {
      return res.status(400).json({ error: 'Source must be savings or dividends' });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const settings = await getSettings();
    const check = checkEligibility(member, source, amt, new Date(), settings, {
      allowOverride: !!overrideReason,
      overrideReason: overrideReason || ''
    });

    if (!check.eligible) {
      return res.status(400).json({ error: check.reason });
    }

    // Save override reason if used
    const finalNotes = check.overrideUsed
      ? `[OVERRIDE: ${overrideReason}] ${notes || ''}`.trim()
      : (notes || '');

    const withdrawal = await Withdrawal.create({
      memberId,
      memberName: `${member.firstName} ${member.surname}`,
      memberNumber: member.memberNumber,
      source,
      amount: amt,
      period: check.period,
      requestedDate: new Date(),
      status: 'pending',
      requestedBy: requestedBy || 'member',
      notes: finalNotes
    });

    res.status(201).json({
      success: true,
      withdrawal,
      overrideUsed: check.overrideUsed,
      message: `Withdrawal request of UGX ${fmt(amt)} submitted${check.overrideUsed ? ' (OVERRIDE)' : ''}. Awaiting approval.`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL ====================
exports.getAllWithdrawals = async (req, res) => {
  try {
    const { status, memberId, period, source, startDate, endDate } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (memberId) filter.memberId = memberId;
    if (period) filter.period = period;
    if (source) filter.source = source;

    if (startDate || endDate) {
      filter.requestedDate = {};
      if (startDate) filter.requestedDate.$gte = new Date(startDate);
      if (endDate) filter.requestedDate.$lte = new Date(endDate);
    }

    const withdrawals = await Withdrawal.find(filter)
      .populate('memberId', 'firstName surname memberNumber')
      .sort('-requestedDate')
      .limit(500);

    const totalPending = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
    const totalPaid = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0);

    res.json({ withdrawals, total: withdrawals.length, totalPending, totalPaid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate('memberId', 'firstName surname memberNumber contact');
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    res.json(withdrawal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER'S WITHDRAWALS ====================
exports.getMemberWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ memberId: req.params.memberId }).sort('-requestedDate');
    const totalPaid = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0);
    res.json({ withdrawals, totalPaid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== APPROVE ====================
exports.approveWithdrawal = async (req, res) => {
  try {
    const { approvedBy } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a ${withdrawal.status} withdrawal` });
    }

    const member = await Member.findById(withdrawal.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const settings = await getSettings();
    const isOverride = withdrawal.period === 'override';
    const check = checkEligibility(member, withdrawal.source, withdrawal.amount, new Date(), settings, {
      allowOverride: isOverride,
      overrideReason: isOverride ? 'Re-confirmed on approval' : ''
    });

    if (!check.eligible) {
      return res.status(400).json({ error: 'Cannot approve: ' + check.reason });
    }

    withdrawal.status = 'approved';
    withdrawal.approvedDate = new Date();
    withdrawal.approvedBy = approvedBy || 'admin';
    await withdrawal.save();

    res.json({ success: true, message: 'Withdrawal approved. Ready for payment.', withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== REJECT ====================
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { rejectedBy, reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Rejection reason is required' });

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a ${withdrawal.status} withdrawal` });
    }

    withdrawal.status = 'rejected';
    withdrawal.rejectedBy = rejectedBy || 'admin';
    withdrawal.rejectionReason = reason;
    await withdrawal.save();

    res.json({ success: true, message: 'Withdrawal rejected', withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RECORD PAYMENT (also creates receipt) ====================
exports.recordPayment = async (req, res) => {
  try {
    const { paymentMethod, paymentReference, paidBy } = req.body;

    if (!paymentMethod || !['cash', 'mobile_money'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Payment method must be cash or mobile_money' });
    }

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ error: `Only approved withdrawals can be paid. This is ${withdrawal.status}.` });
    }

    const member = await Member.findById(withdrawal.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Deduct from correct pocket
    if (withdrawal.source === 'savings') {
      if (Number(member.savings) < withdrawal.amount) {
        return res.status(400).json({ error: `Insufficient savings. Available: UGX ${fmt(member.savings)}` });
      }
      member.savings = Number(member.savings) - withdrawal.amount;
    } else if (withdrawal.source === 'dividends') {
      if (Number(member.dividendBalance) < withdrawal.amount) {
        return res.status(400).json({ error: `Insufficient dividends. Available: UGX ${fmt(member.dividendBalance)}` });
      }
      member.dividendBalance = Number(member.dividendBalance) - withdrawal.amount;
      member.totalDividendsWithdrawn = (Number(member.totalDividendsWithdrawn) || 0) + withdrawal.amount;
    }
    await member.save();

    withdrawal.status = 'paid';
    withdrawal.paidDate = new Date();
    withdrawal.paidBy = paidBy || 'admin';
    withdrawal.paymentMethod = paymentMethod;
    withdrawal.paymentReference = paymentReference || '';
    await withdrawal.save();

    // ==================== AUTO-CREATE RECEIPT ====================
    let receipt = null;
    try {
      let receiptNumber;
      try {
        receiptNumber = await generateReceiptNumber(new Date());
      } catch (err) {
        receiptNumber = await generateReceiptNumber(new Date());
      }

      receipt = await Receipt.create({
        receiptNumber,
        type: withdrawal.source === 'savings' ? 'savings_withdrawal' : 'dividend',
        memberId: member._id,
        memberName: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        amount: withdrawal.amount,
        description: `Withdrawal from ${withdrawal.source} (${withdrawal.period})`,
        category: withdrawal.source,
        lineItems: [{
          label: `Withdrawal — ${withdrawal.source.charAt(0).toUpperCase() + withdrawal.source.slice(1)}`,
          category: withdrawal.source,
          amount: withdrawal.amount,
          description: `Paid via ${paymentMethod}${paymentReference ? ' — Ref: ' + paymentReference : ''}`
        }],
        referenceId: withdrawal._id,
        referenceModel: 'Withdrawal',
        referenceNumber: withdrawal._id.toString().slice(-8),
        date: new Date(),
        issuedBy: paidBy || 'admin',
        issuedByName: paidBy || '',
        notes: `Payment method: ${paymentMethod}${paymentReference ? ' | Ref: ' + paymentReference : ''}`
      });
    } catch (err) {
      console.error('Auto-receipt error on withdrawal payment:', err.message);
    }

    res.json({
      success: true,
      message: `UGX ${fmt(withdrawal.amount)} paid out from ${withdrawal.source}`,
      withdrawal,
      receipt,
      newBalances: {
        savings: member.savings,
        dividendBalance: member.dividendBalance
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== CANCEL ====================
exports.cancelWithdrawal = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending withdrawals can be cancelled' });
    }

    withdrawal.status = 'cancelled';
    await withdrawal.save();

    res.json({ success: true, message: 'Withdrawal cancelled', withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== SUMMARY ====================
exports.getSummary = async (req, res) => {
  try {
    const settings = await getSettings();
    const window = isWithinWindow(new Date(), settings);

    const pending = await Withdrawal.countDocuments({ status: 'pending' });
    const approved = await Withdrawal.countDocuments({ status: 'approved' });
    const paid = await Withdrawal.countDocuments({ status: 'paid' });
    const rejected = await Withdrawal.countDocuments({ status: 'rejected' });

    const all = await Withdrawal.find({ status: 'paid' });
    const totalPaid = all.reduce((s, w) => s + w.amount, 0);

    res.json({
      window,
      counts: { pending, approved, paid, rejected },
      totalPaid,
      windowLabel: getWindowLabel(settings)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};