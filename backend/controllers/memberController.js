const Member = require('../models/Member');
const bcrypt = require('bcryptjs');
const { generateStatementPDF } = require('../utils/statementPDF');

// ==================== GENERATE 5-LETTER PASSWORD ====================
const generatePassword = () => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let password = '';
  for (let i = 0; i < 5; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return password;
};

// ==================== CREATE MEMBER ====================
exports.createMember = async (req, res) => {
  try {
    const {
      firstName, surname, occupation, contact, email, address,
      memberNumber, dateOfBirth, shares, nextOfKin, photo
    } = req.body;

    // Check duplicates
    const existingMember = await Member.findOne({
      $or: [{ email }, { memberNumber }]
    });
    if (existingMember) {
      return res.status(400).json({
        error: 'Member with this email or member number already exists'
      });
    }

    // Generate 5-letter password
    const plainPassword = generatePassword();

    // Create member
    const member = new Member({
      firstName,
      surname,
      occupation: occupation || '',
      contact,
      email,
      address,
      photo: photo || '',
      memberNumber,
      dateOfBirth,
      password: plainPassword,
      shares: {
        golden: shares?.golden || 0,
        platinum: shares?.platinum || 0,
        silver: shares?.silver || 0,
        bronze: shares?.bronze || 0
      },
      nextOfKin: {
        fullName: nextOfKin?.fullName,
        relationship: nextOfKin?.relationship,
        contact: nextOfKin?.contact,
        email: nextOfKin?.email || '',
        address: nextOfKin?.address
      }
    });

    await member.save();

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      member: {
        _id: member._id,
        firstName: member.firstName,
        surname: member.surname,
        memberNumber: member.memberNumber,
        email: member.email
      },
      generatedPassword: plainPassword
    });

  } catch (error) {
    console.error('CREATE MEMBER ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL ====================
exports.getAllMembers = async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET BY ID ====================
exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== UPDATE ====================
exports.updateMember = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const fields = ['firstName', 'surname', 'occupation', 'contact', 'email', 'address', 'dateOfBirth', 'active', 'photo'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) member[f] = req.body[f];
    });

    if (req.body.shares) {
      member.shares = { ...member.shares.toObject(), ...req.body.shares };
    }

    if (req.body.nextOfKin) {
      member.nextOfKin = { ...member.nextOfKin.toObject(), ...req.body.nextOfKin };
    }

    await member.save();
    res.json({ success: true, member });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE ====================
exports.deleteMember = async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true, message: 'Member deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GENERATE PASSWORD ====================
exports.generatePassword = async (req, res) => {
  res.json({ password: generatePassword() });
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
// ==================== MEMBER STATEMENT (LEDGER) ====================
exports.getMemberStatement = async (req, res) => {
  try {
      const memberId = req.params.id;
    const { from, to } = req.query;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const Saving = require('../models/Saving');
    const Repayment = require('../models/Repayment');
    const Loan = require('../models/Loan');
    const Withdrawal = require('../models/Withdrawal');
    const Dividend = require('../models/Dividend');

    const fromDate = from ? new Date(from) : new Date('2000-01-01');
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const entries = [];

    // ---- CASH IN: Savings ----
    const savings = await Saving.find({
      memberId,
      date: { $gte: fromDate, $lte: toDate }
    });
    for (const s of savings) {
      if (['monthly', 'extra', 'misc', 'penalty', 'membership', 'donation'].includes(s.category)) {
        entries.push({
          date: s.date,
          description: `${s.category.charAt(0).toUpperCase() + s.category.slice(1)} — ${s.description || ''}`,
          cashIn: s.amount,
          cashOut: 0
        });
      }
    }

    // ---- CASH IN: Dividends received ----
    const dividends = await Dividend.find({
      'distributions.memberId': memberId,
      distributionDate: { $gte: fromDate, $lte: toDate }
    });
    for (const d of dividends) {
      const mine = d.distributions.find(x => x.memberId && x.memberId.toString() === memberId);
      if (mine && mine.totalAmount > 0) {
        entries.push({
          date: d.distributionDate,
          description: `Dividend Distribution`,
          cashIn: mine.totalAmount,
          cashOut: 0
        });
      }
    }

    // ---- CASH OUT: Withdrawals ----
    const withdrawals = await Withdrawal.find({
      memberId,
      status: 'paid',
      paidDate: { $gte: fromDate, $lte: toDate }
    });
    for (const w of withdrawals) {
      entries.push({
        date: w.paidDate,
        description: `Withdrawal — ${w.source} (${w.period})`,
        cashIn: 0,
        cashOut: w.amount
      });
    }

    // ---- CASH OUT: Loan repayments ----
    const loanIds = (await Loan.find({ memberId })).map(l => l._id);
    const repayments = await Repayment.find({
      loanId: { $in: loanIds },
      status: 'paid',
      paidDate: { $gte: fromDate, $lte: toDate }
    });
    for (const r of repayments) {
      entries.push({
        date: r.paidDate,
        description: `Loan Repayment — Installment #${r.installmentNumber}`,
        cashIn: 0,
        cashOut: r.amountPaid
      });
    }

    // Sort chronologically
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance
    let balance = 0;
    let totalIn = 0;
    let totalOut = 0;
    for (const e of entries) {
      totalIn += e.cashIn;
      totalOut += e.cashOut;
      balance += e.cashIn - e.cashOut;
      e.balance = balance;
    }

    res.json({
      member: {
        _id: member._id,
        name: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber
      },
      from: fromDate,
      to: toDate,
      entries,
      totals: {
        cashIn: totalIn,
        cashOut: totalOut,
        closingBalance: balance
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ==================== MEMBER STATEMENT PDF ====================
exports.downloadMemberStatementPDF = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { from, to } = req.query;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const Saving = require('../models/Saving');
    const Repayment = require('../models/Repayment');
    const Loan = require('../models/Loan');
    const Withdrawal = require('../models/Withdrawal');
    const Dividend = require('../models/Dividend');

    const fromDate = from ? new Date(from) : new Date('2000-01-01');
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const entries = [];

    const savings = await Saving.find({ memberId, date: { $gte: fromDate, $lte: toDate } });
    for (const s of savings) {
      if (['monthly', 'extra', 'misc', 'penalty', 'membership', 'donation'].includes(s.category)) {
        entries.push({
          date: s.date,
          description: `${s.category.charAt(0).toUpperCase() + s.category.slice(1)} — ${s.description || ''}`,
          cashIn: Number(s.amount) || 0,
          cashOut: 0
        });
      }
    }

    const dividends = await Dividend.find({
      'distributions.memberId': memberId,
      distributionDate: { $gte: fromDate, $lte: toDate }
    });
    for (const d of dividends) {
      const mine = d.distributions.find(x => x.memberId && x.memberId.toString() === memberId);
      if (mine && mine.totalAmount > 0) {
        entries.push({
          date: d.distributionDate,
          description: 'Dividend Distribution',
          cashIn: mine.totalAmount,
          cashOut: 0
        });
      }
    }

    const withdrawals = await Withdrawal.find({
      memberId, status: 'paid',
      paidDate: { $gte: fromDate, $lte: toDate }
    });
    for (const w of withdrawals) {
      entries.push({
        date: w.paidDate,
        description: `Withdrawal — ${w.source} (${w.period})`,
        cashIn: 0,
        cashOut: Number(w.amount) || 0
      });
    }

    const loanIds = (await Loan.find({ memberId })).map(l => l._id);
    const repayments = await Repayment.find({
      loanId: { $in: loanIds },
      status: 'paid',
      paidDate: { $gte: fromDate, $lte: toDate }
    });
    for (const r of repayments) {
      entries.push({
        date: r.paidDate,
        description: `Loan Repayment — Installment #${r.installmentNumber}`,
        cashIn: 0,
        cashOut: Number(r.amountPaid) || 0
      });
    }

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0, totalIn = 0, totalOut = 0;
    for (const e of entries) {
      totalIn += e.cashIn;
      totalOut += e.cashOut;
      balance += e.cashIn - e.cashOut;
      e.balance = balance;
    }

    await generateStatementPDF({
      member: {
        _id: member._id,
        name: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber
      },
      from: fromDate,
      to: toDate,
      entries,
      totals: { cashIn: totalIn, cashOut: totalOut, closingBalance: balance }
    }, res);
  } catch (error) {
    console.error('Statement PDF error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};