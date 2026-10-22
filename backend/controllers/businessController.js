const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const Account = require('../models/Account');
const { createJournalEntry } = require('../utils/journalHelper');

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
      businessId: business._id,
      balance: 0
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
    // Exclude system businesses (e.g. Loans) — they are managed separately
    const businesses = await Business.find({ isSystem: { $ne: true } }).sort('-createdAt');
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

    const revenue = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const losses = transactions.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);
    const capitalIn = transactions.filter(t => t.type === 'capital_in').reduce((s, t) => s + t.amount, 0);
    const capitalOut = transactions.filter(t => t.type === 'capital_out').reduce((s, t) => s + t.amount, 0);
    const profitExtracted = transactions.filter(t => t.type === 'profit_extraction').reduce((s, t) => s + t.amount, 0);

    const netProfit = revenue - expenses - losses;
    const currentBalance = capitalIn - capitalOut + revenue - expenses - losses - profitExtracted;

    const clubAcc = await Account.findOne({ code: '1000' });
    const clubCapitalAvailable = clubAcc ? Number(clubAcc.balance) || 0 : 0;

    res.json({
      business,
      transactions,
      summary: {
        capitalIn,
        capitalOut,
        revenue,
        expenses,
        losses,
        profitExtracted,
        netProfit,
        currentBalance,
        clubCapitalAvailable
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET CLUB CAPITAL AVAILABLE (LIVE) ====================
exports.getClubCapitalAvailable = async (req, res) => {
  try {
    const clubAcc = await Account.findOne({ code: '1000' });
    res.json({ balance: Number(clubAcc?.balance) || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ALLOCATE CAPITAL FROM CLUB CAPITAL ====================
exports.allocateCapital = async (req, res) => {
  try {
    const { businessId, amount, notes } = req.body;
    const fundAmount = Number(amount);

    if (!businessId) return res.status(400).json({ error: 'Business ID is required' });
    if (!fundAmount || fundAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const clubAcc = await Account.findOne({ code: '1000' });
    if (!clubAcc) return res.status(400).json({ error: 'Club Capital account not found' });

    const clubBalance = Number(clubAcc.balance) || 0;
    if (clubBalance < fundAmount) {
      return res.status(400).json({ error: `Insufficient Club Capital. Available: UGX ${clubBalance.toLocaleString()}` });
    }

    // Deduct from Club Capital
    clubAcc.balance = clubBalance - fundAmount;
    await clubAcc.save();

    // Add to business
    business.currentBalance = (Number(business.currentBalance) || 0) + fundAmount;
    business.totalCapitalAllocated = (Number(business.totalCapitalAllocated) || 0) + fundAmount;
    await business.save();

    // Log transaction
    await BusinessTransaction.create({
      businessId: business._id,
      type: 'capital_in',
      amount: fundAmount,
      description: notes || 'Capital allocated from Club Capital',
      sourceType: 'club_capital',
      date: new Date()
    });

    // Journal entry — best-effort, won't block if it fails
    try {
      await createJournalEntry({
        date: new Date(),
        description: `Capital to ${business.name}: UGX ${fundAmount.toLocaleString()}`,
        sourceType: 'business',
        lines: [
          { accountCode: business.fundAccountCode || '1100', debit: fundAmount },
          { accountCode: '1000', credit: fundAmount }
        ]
      });
    } catch (e) { console.error('Journal error (non-fatal):', e.message); }

    res.json({
      success: true,
      message: `UGX ${fundAmount.toLocaleString()} allocated to ${business.name}`,
      clubCapitalBalance: clubAcc.balance,
      businessBalance: business.currentBalance
    });
  } catch (error) {
    console.error('Allocate capital error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== RETURN CAPITAL TO CLUB CAPITAL ====================
exports.returnCapital = async (req, res) => {
  try {
    const { businessId, amount, notes } = req.body;
    const returnAmount = Number(amount);

    if (!businessId) return res.status(400).json({ error: 'Business ID is required' });
    if (!returnAmount || returnAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const businessBalance = Number(business.currentBalance) || 0;
    if (businessBalance < returnAmount) {
      return res.status(400).json({ error: `Insufficient business balance. Available: UGX ${businessBalance.toLocaleString()}` });
    }

    business.currentBalance = businessBalance - returnAmount;
business.totalCapitalAllocated = Math.max(0, (Number(business.totalCapitalAllocated) || 0) - returnAmount);
await business.save();

    const clubAcc = await Account.findOne({ code: '1000' });
    if (!clubAcc) return res.status(400).json({ error: 'Club Capital account not found' });

    clubAcc.balance = (Number(clubAcc.balance) || 0) + returnAmount;
    await clubAcc.save();

    await BusinessTransaction.create({
      businessId: business._id,
      type: 'capital_out',
      amount: returnAmount,
      description: notes || 'Capital returned to Club Capital',
      sourceType: 'club_capital',
      date: new Date()
    });

    try {
      await createJournalEntry({
        date: new Date(),
        description: `Capital returned from ${business.name}: UGX ${returnAmount.toLocaleString()}`,
        sourceType: 'business',
        lines: [
          { accountCode: '1000', debit: returnAmount },
          { accountCode: business.fundAccountCode || '1100', credit: returnAmount }
        ]
      });
    } catch (e) { console.error('Journal error (non-fatal):', e.message); }

    res.json({
      success: true,
      message: `UGX ${returnAmount.toLocaleString()} returned to Club Capital`,
      clubCapitalBalance: clubAcc.balance,
      businessBalance: business.currentBalance
    });
  } catch (error) {
    console.error('Return capital error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== PURCHASE STOCK ====================
exports.purchaseStock = async (req, res) => {
  try {
    const Product = require('../models/Product');

    const { businessId, productId, quantity, unitCost, description, date } = req.body;

    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
    if (!cost || cost < 0) return res.status(400).json({ error: 'Unit cost must be valid' });

    const business = await Business.findById(businessId);
    if (!business) return res.status(400).json({ error: 'Business not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(400).json({ error: 'Product not found' });

    const totalCost = qty * cost;

    if (totalCost > Number(business.currentBalance || 0)) {
      return res.status(400).json({
        error: `Insufficient business fund. Available: UGX ${(business.currentBalance || 0).toLocaleString()}, needed: UGX ${totalCost.toLocaleString()}`
      });
    }

    const txnDate = date ? new Date(date) : new Date();

    const txn = new BusinessTransaction({
      businessId,
      type: 'expense',
      amount: totalCost,
      description: description || `Stock purchase: ${qty} x ${product.name}`,
      category: 'inventory',
      date: txnDate,
      createdBy: req.body.createdBy || 'admin'
    });
    await txn.save();

    try {
      await createJournalEntry({
        date: txnDate,
        description: `Stock purchase for ${business.name}: ${qty} x ${product.name}`,
        reference: txn._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: '4000', debit: totalCost },
          { accountCode: business.fundAccountCode, credit: totalCost }
        ],
        createdBy: req.body.createdBy || 'admin'
      });
    } catch (e) { console.error('Journal error (non-fatal):', e.message); }

    product.stock = (Number(product.stock) || 0) + qty;
    if (product.costPrice !== undefined) product.costPrice = cost;
    await product.save();

    const fundAcc = await Account.findOne({ code: business.fundAccountCode });
    if (fundAcc) {
      fundAcc.balance = Math.max(0, (Number(fundAcc.balance) || 0) - totalCost);
      await fundAcc.save();
    }

    business.currentBalance = Math.max(0, (Number(business.currentBalance) || 0) - totalCost);
    await business.save();

    res.json({
      success: true,
      message: `Purchased ${qty} units of ${product.name} for UGX ${totalCost.toLocaleString()}`,
      transaction: txn,
      product,
      newBusinessBalance: business.currentBalance,
      newStock: product.stock
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RECORD TRANSACTION ====================
exports.recordTransaction = async (req, res) => {
  try {
    const { businessId, type, amount, description, date, reference } = req.body;

    const business = await Business.findById(businessId);
    if (!business) return res.status(400).json({ error: 'Business not found' });

    if (!['revenue', 'expense', 'loss'].includes(type)) {
      return res.status(400).json({ error: 'Invalid transaction type for this endpoint' });
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
    await txn.save();

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

    try {
      await createJournalEntry({
        date: txnDate,
        description: `${type} for ${business.name}: ${description || ''}`,
        reference: txn._id.toString(),
        sourceType: 'business',
        lines,
        createdBy: req.body.createdBy || 'admin'
      });
    } catch (e) { console.error('Journal error (non-fatal):', e.message); }

    const fundAcc = await Account.findOne({ code: business.fundAccountCode });
    if (fundAcc) {
      if (type === 'revenue') {
        fundAcc.balance = (Number(fundAcc.balance) || 0) + Number(amount);
      } else {
        fundAcc.balance = Math.max(0, (Number(fundAcc.balance) || 0) - Number(amount));
      }
      await fundAcc.save();
    }

    if (type === 'revenue') business.currentBalance = (Number(business.currentBalance) || 0) + Number(amount);
    if (type === 'expense' || type === 'loss') business.currentBalance = Math.max(0, (Number(business.currentBalance) || 0) - Number(amount));
    await business.save();

    res.json({ success: true, transaction: txn });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== EXTRACT PROFIT ====================
exports.extractProfit = async (req, res) => {
  try {
    const { businessId, amount, description, date } = req.body;

    const business = await Business.findById(businessId);
    if (!business) return res.status(400).json({ error: 'Business not found' });

    if (amount > business.currentBalance) {
      return res.status(400).json({ error: `Cannot extract ${amount}. Current balance is ${business.currentBalance}` });
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
    await txn.save();

    try {
      await createJournalEntry({
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
    } catch (e) { console.error('Journal error (non-fatal):', e.message); }

    const clubAcc = await Account.findOne({ code: '1000' });
    if (clubAcc) {
      clubAcc.balance = (Number(clubAcc.balance) || 0) + Number(amount);
      await clubAcc.save();
    }

    const fundAcc = await Account.findOne({ code: business.fundAccountCode });
    if (fundAcc) {
      fundAcc.balance = Math.max(0, (Number(fundAcc.balance) || 0) - Number(amount));
      await fundAcc.save();
    }

    business.totalProfitExtracted = (Number(business.totalProfitExtracted) || 0) + Number(amount);
    business.currentBalance = Math.max(0, (Number(business.currentBalance) || 0) - Number(amount));
    await business.save();

    res.json({ success: true, transaction: txn });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET TRANSACTIONS ====================
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