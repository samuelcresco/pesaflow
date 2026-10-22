const Member = require('../models/Member');
const Saving = require('../models/Saving');
const Loan = require('../models/Loan');
const Repayment = require('../models/Repayment');
const Dividend = require('../models/Dividend');
const Business = require('../models/Business');
const Account = require('../models/Account');
const Leader = require('../models/Leader');

// Accounts that roll up into Club Capital
const CLUB_CAPITAL_ACCOUNTS = ['1000', '1020', '1030', '1040', '1050', '1060', '1070'];

// ==================== LOGIN ====================
exports.login = async (req, res) => {
  try {
    const { memberNumber, password } = req.body;

    if (!memberNumber || !password) {
      return res.status(400).json({ error: 'Member number and password required' });
    }

    const cleanNumber = String(memberNumber).trim();
    const cleanPassword = String(password).trim();

    const member = await Member.findOne({ memberNumber: cleanNumber }).select('+password');
    if (!member) return res.status(401).json({ error: 'Member not found' });
    if (!member.active) return res.status(401).json({ error: 'Account is inactive' });

    if (!member.password) {
      return res.status(401).json({ error: 'No password set. Contact admin.' });
    }

    const isMatch = await member.comparePassword(cleanPassword);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

    res.json({
      success: true,
      member: {
        id: member._id,
        memberNumber: member.memberNumber,
        name: `${member.firstName} ${member.surname}`,
        role: 'member'
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== FORGOT PASSWORD ====================
exports.forgotPassword = async (req, res) => {
  try {
    const { memberNumber, contact, email, newPassword } = req.body;

    const member = await Member.findOne({ memberNumber });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const phoneMatch = contact && member.contact === contact;
    const emailMatch = email && member.email === email;

    if (!phoneMatch && !emailMatch) {
      return res.status(400).json({ error: 'Phone or email does not match our records' });
    }

    member.password = newPassword;
    await member.save();

    res.json({ success: true, message: 'Password reset. You can now log in.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== CHANGE PASSWORD ====================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const isMatch = await member.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

    member.password = newPassword;
    await member.save();

    res.json({ success: true, message: 'Password changed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== MY PROFILE ====================
exports.getMyProfile = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MY SAVINGS ====================
exports.getMySavings = async (req, res) => {
  try {
    const savings = await Saving.find({ memberId: req.params.id }).sort('-date');

    const totals = {
      monthly: savings.filter(s => s.category === 'monthly').reduce((s, x) => s + Number(x.amount || 0), 0),
      extra: savings.filter(s => s.category === 'extra').reduce((s, x) => s + Number(x.amount || 0), 0),
      penalty: savings.filter(s => s.category === 'penalty').reduce((s, x) => s + Number(x.amount || 0), 0),
      membership: savings.filter(s => s.category === 'membership').reduce((s, x) => s + Number(x.amount || 0), 0),
      misc: savings.filter(s => s.category === 'misc').reduce((s, x) => s + Number(x.amount || 0), 0)
    };

    const member = await Member.findById(req.params.id);
    totals.total = Number(member?.savings) || 0;
    totals.locked = Number(member?.lockedSavings) || 0;

    res.json({ savings, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MY SHARES ====================
exports.getMyShares = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const ShareSettings = require('../models/shareSettings.models');
    const settings = await ShareSettings.findOne();
    const prices = settings?.shareTypes || {
      ordinary: { price: 100000 },
      silver: { price: 250000 },
      golden: { price: 500000 },
      platinum: { price: 1000000 }
    };

    const shares = {
      platinum: { quantity: member.shares.platinum || 0, price: prices.platinum?.price || 0 },
      golden: { quantity: member.shares.golden || 0, price: prices.golden?.price || 0 },
      silver: { quantity: member.shares.silver || 0, price: prices.silver?.price || 0 },
      ordinary: { quantity: member.shares.bronze || 0, price: prices.ordinary?.price || 0 }
    };

    let totalQuantity = 0;
    let totalValue = 0;
    Object.values(shares).forEach(s => {
      s.value = s.quantity * s.price;
      totalQuantity += s.quantity;
      totalValue += s.value;
    });

    res.json({ shares, totalQuantity, totalValue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MY LOANS ====================
exports.getMyLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ memberId: req.params.id }).sort('-createdAt');

    const loansWithDetails = await Promise.all(loans.map(async (loan) => {
      const repayments = await Repayment.find({ loanId: loan._id }).sort('installmentNumber');

      const paidAmount = repayments
        .filter(r => r.status === 'paid')
        .reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);

      const outstanding = repayments
        .filter(r => r.status !== 'paid')
        .reduce((s, r) => s + Number(r.amountDue || 0), 0);

      return {
        ...loan.toObject(),
        repayments,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstandingBalance: Math.round(outstanding * 100) / 100,
        totalInstallments: repayments.length,
        paidInstallments: repayments.filter(r => r.status === 'paid').length
      };
    }));

    res.json(loansWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MY DIVIDENDS ====================
exports.getMyDividends = async (req, res) => {
  try {
    const dividends = await Dividend.find({ 'distributions.memberId': req.params.id });

    const myDividends = dividends.map(d => {
      const mine = d.distributions.find(x => x.memberId && x.memberId.toString() === req.params.id);
      return {
        date: d.distributionDate,
        amount: mine?.totalAmount || 0,
        breakdown: mine
      };
    });

    const total = myDividends.reduce((s, d) => s + d.amount, 0);
    res.json({ dividends: myDividends, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CLUB STATS ====================
exports.getClubStats = async (req, res) => {
  try {
    const members = await Member.find().lean();
    const savings = await Saving.find().lean();
    const businesses = await Business.find().lean();

    // ---- Member savings total (from Member documents) ----
    const totalMemberSavings = members.reduce((s, m) => s + Number(m.savings || 0), 0);

    // ---- Savings breakdown by category ----
    const sumByCat = (cat) => savings
      .filter(s => s.category === cat)
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const totalMonthly = sumByCat('monthly');
    const totalExtra = sumByCat('extra');

    // ---- Read account balances (single source of truth) ----
    const accs = await Account.find({ code: { $in: CLUB_CAPITAL_ACCOUNTS } }).lean();
    const balanceOf = (code) => {
      const a = accs.find(x => x.code === code);
      return Number(a?.balance) || 0;
    };

    const totalClubCapital = accs.reduce((s, a) => s + (Number(a.balance) || 0), 0);

    const totalMembership = balanceOf('1020');
    const totalSharesCapital = balanceOf('1030');
    const totalConstitution = balanceOf('1040');
    const totalPenalty = balanceOf('1050');
    const totalMisc = balanceOf('1060');
    const totalDonation = balanceOf('1070');
    const totalShareValue = balanceOf('1030');
    // ---- Grand total ----
    const grandTotal = totalClubCapital + totalMemberSavings;

    // ---- Total shares count ----
    const totalShares = members.reduce((s, m) =>
      s + Number(m.shares?.platinum || 0) +
          Number(m.shares?.golden || 0) +
          Number(m.shares?.silver || 0) +
          Number(m.shares?.bronze || 0), 0);

    // ---- Business stats ----
    const businessStats = businesses.map(b => ({
      name: b.name,
      currentBalance: b.currentBalance || 0,
      totalProfit: b.totalProfitExtracted || 0
    }));

    res.json({
      grandTotal,
      totalClubCapital,
      totalMemberSavings,
      totalMonthly,
      totalExtra,
      totalMembership,
      totalSharesCapital,
      totalConstitution,
      totalPenalty,
      totalMisc,
      totalDonation,
      totalShareValue,
      totalShares,
      totalMembers: members.length,
      businessStats,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Club stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== LEADERS ====================
exports.getLeaders = async (req, res) => {
  try {
    const leaders = await Leader.find().sort('order');
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== APPLY FOR LOAN ====================
exports.applyForLoan = async (req, res) => {
  try {
    const { type, amount, duration, scheduleUnit, purpose } = req.body;
    const memberId = req.params.id;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    if (member.activeLoanId) {
      return res.status(400).json({ error: 'You already have an active loan' });
    }

    const maxAmount = member.savings * 0.7;
    if (amount > maxAmount) {
      return res.status(400).json({ error: `Max loan is UGX ${maxAmount.toLocaleString()}` });
    }

    const Setting = require('../models/Setting');
    const settings = await Setting.findOne() || {};

    let interestRate;
    if (type === 'emergency') interestRate = settings.emergencyInterest || 5;
    else if (type === 'school_fees') interestRate = settings.schoolFeesInterest || 8;
    else if (type === 'business') interestRate = settings.businessInterest || 10;
    else return res.status(400).json({ error: 'Invalid loan type' });

    const finalDuration = parseInt(duration) || 1;
    const timeInYears = finalDuration / 12;
    const totalRepayable = amount + (amount * (interestRate / 100) * timeInYears);

    const loan = new Loan({
      memberId,
      type,
      amount,
      interestRate,
      duration: finalDuration,
      scheduleUnit: scheduleUnit || 'weekly',
      totalRepayable: Math.round(totalRepayable * 100) / 100,
      purpose,
      status: 'pending',
      appliedBy: 'member'
    });
    await loan.save();

    const installments = finalDuration * 4;
    const installmentAmount = totalRepayable / installments;
    const startDate = new Date();
    const schedule = [];
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(startDate);
      if (scheduleUnit === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else {
        dueDate.setDate(dueDate.getDate() + (i * 7));
      }
      schedule.push({
        loanId: loan._id,
        installmentNumber: i,
        dueDate,
        amountDue: Math.round(installmentAmount * 100) / 100,
        status: 'pending'
      });
    }
    await Repayment.insertMany(schedule);

    res.status(201).json({ success: true, message: 'Loan application submitted', loan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== MEMBER LOAN STATS ====================
exports.getMemberLoanStats = async (req, res) => {
  try {
    const allLoans = await Loan.find({ status: { $in: ['disbursed', 'active', 'closed'] } });

    const totalLoansOut = allLoans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalRepayable = allLoans.reduce((s, l) => s + Number(l.totalRepayable || 0), 0);

    const paidReps = await Repayment.find({ status: 'paid' });

    const totalRepaid = paidReps.reduce(
      (s, r) => s + Number(r.amountPaid || r.amountDue || 0),
      0
    );

    let totalInterestEarned = 0;
    for (const loan of allLoans) {
      const loanTotal = Number(loan.totalRepayable || 0);
      const loanPrincipal = Number(loan.amount || 0);
      if (loanTotal === 0) continue;

      const interestRatio = (loanTotal - loanPrincipal) / loanTotal;

      const loanPaid = paidReps
        .filter(r => String(r.loanId) === String(loan._id))
        .reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);

      totalInterestEarned += loanPaid * interestRatio;
    }

    const outstanding = Math.max(0, totalRepayable - totalRepaid);

    res.json({
      totalLoansOut: Math.round(totalLoansOut),
      totalRepaid: Math.round(totalRepaid),
      outstanding: Math.round(outstanding),
      totalInterestEarned: Math.round(totalInterestEarned)
    });
  } catch (err) {
    console.error('getMemberLoanStats error:', err);
    res.status(500).json({ error: err.message });
  }
};