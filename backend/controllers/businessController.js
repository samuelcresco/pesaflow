const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const Account = require('../models/Account');
const { createJournalEntry } = require('../utils/journalHelper');
const mongoose = require('mongoose');

// ==================== CREATE BUSINESS ====================
exports.createBusiness = async (req, res) => {
  try {
    const { name, description, type, startDate } = req.body;

    const business = await Business.create({
      name,
      description,
      type: type || 'operating',
      startDate: startDate || new Date(),
      createdBy: req.body.createdBy || 'admin'
    });

    // Create a fund account for this business
    const accountCode = `11${String(await Business.countDocuments()).padStart(2, '0')}0`;
    await Account.create({
      code: accountCode,
      name: `Business Fund - ${name}`,
      type: 'Asset',
      category: 'business',
      businessId: business._id
    });

    business.fundAccountCode = accountCode;
    await business.save();

    res.status(201).json({ success: true, business });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL BUSINESSES ====================
exports.getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find().sort('-createdAt');
    res.json(businesses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE BUSINESS ====================
exports.getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const transactions = await BusinessTransaction.find({ businessId: business._id }).sort('-date');

    // Calculate P&L
    const revenue = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const losses = transactions.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);
    const capitalIn = transactions.filter(t => t.type === 'capital_in').reduce((s, t) => s + t.amount, 0);
    const profitExtracted = transactions.filter(t => t.type === 'profit_extraction').reduce((s, t) => s + t.amount, 0);

    const netProfit = revenue - expenses - losses;
    const currentBalance = capitalIn + revenue - expenses - losses - profitExtracted;

    res.json({
      business,
      transactions,
      summary: {
        capitalIn,
        revenue,
        expenses,
        losses,
        profitExtracted,
        netProfit,
        currentBalance
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ALLOCATE CAPITAL (Club Capital → Business) ====================
exports.allocateCapital = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { businessId, amount, description, date } = req.body;

    const business = await Business.findById(businessId).session(session);
    if (!business) throw new Error('Business not found');

    const txnDate = date ? new Date(date) : new Date();

    // Create business transaction
    const txn = new BusinessTransaction({
      businessId,
      type,
      amount,
      description,
      reference,
      category: req.body.category || '',
      payee: req.body.payee || '',
      cashier: req.body.cashier || '',
      receiptImage: req.body.receiptImage || '',
      date: txnDate,
      createdBy: req.body.createdBy || 'admin'
    });
    // Journal entry: Debit Business Fund / Credit Club Capital
    const journal = await createJournalEntry({
      date: txnDate,
      description: `Capital allocated to ${business.name}`,
      reference: txn._id.toString(),
      sourceType: 'business',
      lines: [
        { accountCode: business.fundAccountCode, debit: amount },
        { accountCode: '1000', credit: amount }
      ],
      createdBy: req.body.createdBy || 'admin'
    });

    txn.journalEntryId = journal._id;
    await txn.save({ session });

    // Update business totals
    business.totalCapitalAllocated += amount;
    business.currentBalance += amount;
    await business.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, transaction: txn, journal });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

// ==================== RECORD TRANSACTION (revenue/expense/loss) ====================
exports.recordTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { businessId, type, amount, description, date, reference } = req.body;

    const business = await Business.findById(businessId).session(session);
    if (!business) throw new Error('Business not found');

    if (!['revenue', 'expense', 'loss'].includes(type)) {
      throw new Error('Invalid transaction type for this endpoint');
    }

    const txnDate = date ? new Date(date) : new Date();

    const txn = new BusinessTransaction({
      businessId,
      type,
      amount,
      description,
      reference,
      date: txnDate,
      createdBy: req.body.createdBy || 'admin'
    });
    await txn.save({ session });

    // Journal entry based on type
    let lines;
    if (type === 'revenue') {
      lines = [
        { accountCode: business.fundAccountCode, debit: amount },
        { accountCode: '3010', credit: amount }
      ];
    } else if (type === 'expense') {
      lines = [
        { accountCode: '4000', debit: amount },
        { accountCode: business.fundAccountCode, credit: amount }
      ];
    } else if (type === 'loss') {
      lines = [
        { accountCode: '4020', debit: amount },
        { accountCode: business.fundAccountCode, credit: amount }
      ];
    }

    const journal = await createJournalEntry({
      date: txnDate,
      description: `${type} for ${business.name}: ${description || ''}`,
      reference: txn._id.toString(),
      sourceType: 'business',
      lines,
      createdBy: req.body.createdBy || 'admin'
    });

    txn.journalEntryId = journal._id;
    await txn.save({ session });

    // Update business balance
    if (type === 'revenue') business.currentBalance += amount;
    if (type === 'expense' || type === 'loss') business.currentBalance -= amount;
    await business.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, transaction: txn, journal });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

// ==================== EXTRACT PROFIT (Business → Club Capital) ====================
exports.extractProfit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { businessId, amount, description, date } = req.body;

    const business = await Business.findById(businessId).session(session);
    if (!business) throw new Error('Business not found');

    if (amount > business.currentBalance) {
      throw new Error(`Cannot extract ${amount}. Current balance is ${business.currentBalance}`);
    }

    const txnDate = date ? new Date(date) : new Date();

    const txn = new BusinessTransaction({
      businessId,
      type: 'profit_extraction',
      amount,
      description: description || `Profit extracted from ${business.name}`,
      date: txnDate,
      createdBy: req.body.createdBy || 'admin'
    });
    await txn.save({ session });

    // Journal: Debit Club Capital / Credit Business Fund
    const journal = await createJournalEntry({
      date: txnDate,
      description: `Profit extracted from ${business.name}`,
      reference: txn._id.toString(),
      sourceType: 'business',
      lines: [
        { accountCode: '1000', debit: amount },
        { accountCode: business.fundAccountCode, credit: amount }
      ],
      createdBy: req.body.createdBy || 'admin'
    });

    txn.journalEntryId = journal._id;
    await txn.save({ session });

    business.totalProfitExtracted += amount;
    business.currentBalance -= amount;
    await business.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, transaction: txn, journal });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET TRANSACTIONS (with filters) ====================
exports.getTransactions = async (req, res) => {
  try {
    const { businessId, month, year, type } = req.query;
    const filter = {};
    if (businessId) filter.businessId = businessId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (type) filter.type = type;

    const transactions = await BusinessTransaction.find(filter)
      .populate('businessId', 'name')
      .sort('-date');
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELETE BUSINESS ====================
exports.deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    if (business.isSystem) return res.status(400).json({ error: 'Cannot delete system business' });

    await Business.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Business deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};