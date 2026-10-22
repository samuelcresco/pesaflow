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
      memberNumber, dateOfBirth, shares, nextOfKin, photo, signature, password, cardQrMessage
    } = req.body;

    const existingMember = await Member.findOne({
      $or: [{ email }, { memberNumber }]
    });
    if (existingMember) {
      return res.status(400).json({
        error: 'Member with this email or member number already exists'
      });
    }

    const plainPassword = (password && String(password).trim().length >= 4)
      ? String(password).trim()
      : generatePassword();

    const member = new Member({
      firstName,
      surname,
      occupation: occupation || '',
      contact,
      email,
      address,
      photo: photo || '',
      signature: signature || '',
      cardQrMessage: cardQrMessage || '',
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

// ==================== GET BY MEMBER NUMBER ====================
exports.getMemberByNumber = async (req, res) => {
  try {
    const member = await Member.findOne({ memberNumber: req.params.memberNumber });
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

    const fields = ['firstName', 'surname', 'occupation', 'contact', 'email', 'address', 'dateOfBirth', 'active', 'photo', 'signature', 'cardQrMessage'];
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

// ==================== RESET PASSWORD (Admin) ====================
exports.resetMemberPassword = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).select('+password');
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const newPlainPassword = generatePassword();
    member.password = newPlainPassword;
    await member.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
      memberNumber: member.memberNumber,
      name: `${member.firstName} ${member.surname}`,
      newPassword: newPlainPassword
    });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error.message);
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

// ==================== SHARED: BUILD STATEMENT ENTRIES ====================
async function buildStatementEntries(memberId, from, to) {
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
    const cat = s.category;
    const amt = Number(s.amount) || 0;

    if (cat === 'constitution') {
      entries.push({
        date: s.date,
        description: `Constitution Fee — ${s.description || ''}`,
        cashIn: 0,
        cashOut: Math.abs(amt)
      });
      continue;
    }

    if (['monthly', 'extra', 'misc', 'penalty', 'membership', 'donation'].includes(cat)) {
      entries.push({
        date: s.date,
        description: `${cat.charAt(0).toUpperCase() + cat.slice(1)} — ${s.description || ''}`,
        cashIn: amt > 0 ? amt : 0,
        cashOut: amt < 0 ? Math.abs(amt) : 0
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
        cashIn: Number(mine.totalAmount) || 0,
        cashOut: 0
      });
    }
  }

  const loans = await Loan.find({ memberId });
  for (const l of loans) {
    if (l.disbursedDate && l.disbursedDate >= fromDate && l.disbursedDate <= toDate) {
      const netAmount = Number(l.netDisbursed) > 0
        ? Number(l.netDisbursed)
        : Math.max(0, Number(l.amount || 0) - Number(l.processingFee || 0));

      entries.push({
        date: l.disbursedDate,
        description: `Loan Disbursed — ${l.type.replace('_', ' ')}`,
        cashIn: netAmount,
        cashOut: 0
      });

      if (Number(l.processingFee) > 0) {
        entries.push({
          date: l.disbursedDate,
          description: `Loan Processing Fee (${l.processingFeePercent || 0}%)`,
          cashIn: 0,
          cashOut: Number(l.processingFee)
        });
      }
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

  const loanIds = loans.map(l => l._id);
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

  return {
    from: fromDate,
    to: toDate,
    entries,
    totals: { cashIn: totalIn, cashOut: totalOut, closingBalance: balance }
  };
}

// ==================== MEMBER STATEMENT (LEDGER JSON) ====================
exports.getMemberStatement = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { from, to } = req.query;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const data = await buildStatementEntries(memberId, from, to);

    res.json({
      member: {
        _id: member._id,
        name: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber
      },
      ...data
    });
  } catch (error) {
    console.error('Statement error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER STATEMENT PDF ====================
exports.downloadMemberStatementPDF = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { from, to } = req.query;

    // Stop the browser from caching the old PDF
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const data = await buildStatementEntries(memberId, from, to);

    // Read the checkboxes from the URL
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    await generateStatementPDF({
      member: {
        _id: member._id,
        name: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber
      },
      from: data.from,
      to: data.to,
      entries: data.entries,
      totals: data.totals
    }, res, requestedSigs);

  } catch (error) {
    console.error('Statement PDF error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};