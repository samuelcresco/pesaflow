const Business = require('../models/Business');
const ProfitDeclaration = require('../models/ProfitDeclaration');
const Account = require('../models/Account');
const BusinessTransaction = require('../models/BusinessTransaction');
const { createJournalEntry } = require('../utils/journalHelper');
const { generateDeclarationNumber } = require('../utils/profitDeclarationNumber');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== DECLARE PROFIT (business → pool) ====================
exports.declareProfit = async (req, res) => {
  try {
    const { businessId, amount, notes, declaredBy } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });

    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const biz = await Business.findById(businessId);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.isSystem) return res.status(400).json({ error: 'Cannot declare profit from system business (Loan Business uses its own interest flow)' });

    const currentBal = Number(biz.currentBalance) || 0;
    const retention = Number(biz.minimumRetention) || 0;
    const maxDeclarable = Math.max(0, currentBal - retention);

    if (amt > maxDeclarable) {
      return res.status(400).json({
        error: `Cannot declare UGX ${fmt(amt)}. Business must retain UGX ${fmt(retention)}. Max declarable: UGX ${fmt(maxDeclarable)}`,
        currentBalance: currentBal,
        minimumRetention: retention,
        maxDeclarable
      });
    }

    // Generate declaration number
    let declarationNumber;
    try {
      declarationNumber = await generateDeclarationNumber();
    } catch (err) {
      declarationNumber = await generateDeclarationNumber();
    }

    const balBefore = currentBal;
    const balAfter = currentBal - amt;

    // Create declaration record
    const declaration = await ProfitDeclaration.create({
      declarationNumber,
      businessId,
      businessName: biz.name,
      amount: amt,
      businessBalanceBefore: balBefore,
      businessBalanceAfter: balAfter,
      type: 'declaration',
      notes: notes || '',
      declaredBy: declaredBy || 'admin'
    });

    // Update business balance
    biz.currentBalance = balAfter;
    biz.totalProfitDeclared = (Number(biz.totalProfitDeclared) || 0) + amt;
    await biz.save();

    // Record BusinessTransaction (profit extraction from business side)
    await BusinessTransaction.create({
      businessId,
      type: 'profit_extraction',
      amount: amt,
      description: `Profit declared to Pool — ${declarationNumber}`,
      reference: declaration._id.toString(),
      date: new Date(),
      createdBy: declaredBy || 'admin'
    });

    // Journal: Debit Profit Pool (1400) / Credit Business Fund
    try {
      const journal = await createJournalEntry({
        date: new Date(),
        description: `Profit declared from ${biz.name} — ${declarationNumber}`,
        reference: declaration._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: '1400', debit: amt },
          { accountCode: biz.fundAccountCode || '1100', credit: amt }
        ],
        createdBy: declaredBy || 'admin'
      });
      declaration.journalEntryId = journal._id;
      await declaration.save();
    } catch (e) { console.error('Journal error:', e.message); }

    res.status(201).json({ success: true, declaration, businessBalance: biz.currentBalance });
  } catch (error) {
    console.error('DECLARE PROFIT ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== EXTRACT FROM POOL (pool → Club Capital) ====================
exports.extractFromPool = async (req, res) => {
  try {
    const { amount, notes, extractedBy } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const poolAcc = await Account.findOne({ code: '1400' });
    if (!poolAcc) return res.status(400).json({ error: 'Profit Pool account (1400) not found' });

    const poolBal = Number(poolAcc.balance) || 0;
    if (amt > poolBal) {
      return res.status(400).json({ error: `Insufficient pool. Available: UGX ${fmt(poolBal)}` });
    }

    let declarationNumber;
    try {
      declarationNumber = await generateDeclarationNumber();
    } catch (err) {
      declarationNumber = await generateDeclarationNumber();
    }

    const extraction = await ProfitDeclaration.create({
      declarationNumber,
      businessId: null,
      businessName: 'Consolidated Profit Pool',
      amount: amt,
      type: 'extraction',
      notes: notes || 'Manual extraction to Club Capital',
      declaredBy: extractedBy || 'admin'
    });

    // Journal: Debit Club Capital / Credit Profit Pool
    try {
      const journal = await createJournalEntry({
        date: new Date(),
        description: `Extract from Profit Pool to Club Capital — ${declarationNumber}`,
        reference: extraction._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: '1000', debit: amt },
          { accountCode: '1400', credit: amt }
        ],
        createdBy: extractedBy || 'admin'
      });
      extraction.journalEntryId = journal._id;
      await extraction.save();
    } catch (e) { console.error('Journal error:', e.message); }

    const newPoolBal = (Number(poolAcc.balance) || 0) - amt;
    res.json({
      success: true,
      extraction,
      poolBalance: newPoolBal,
      message: `UGX ${fmt(amt)} moved from Profit Pool to Club Capital`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== AUTO-MILESTONE CHECK ====================
// When pool >= 1,000,000 → auto-move 500,000 to Club Capital. Repeats.
async function checkPoolMilestone() {
  const poolAcc = await Account.findOne({ code: '1400' });
  if (!poolAcc) return;

  let bal = Number(poolAcc.balance) || 0;

  while (bal >= 1000000) {
    const clubAcc = await Account.findOne({ code: '1000' });
    if (!clubAcc) break;

    const transferAmount = 500000;

    let declarationNumber;
    try {
      declarationNumber = await generateDeclarationNumber();
    } catch (err) { declarationNumber = 'PD-AUTO-' + Date.now(); }

    const milestone = await ProfitDeclaration.create({
      declarationNumber,
      businessId: null,
      businessName: 'Consolidated Profit Pool',
      amount: transferAmount,
      type: 'milestone',
      isAutoMilestone: true,
      notes: 'Auto milestone: pool ≥ 1M → 500k to Club Capital'
    });

    try {
      const journal = await createJournalEntry({
        date: new Date(),
        description: `Auto milestone: Profit Pool to Club Capital — ${declarationNumber}`,
        reference: milestone._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: '1000', debit: transferAmount },
          { accountCode: '1400', credit: transferAmount }
        ]
      });
      milestone.journalEntryId = journal._id;
      await milestone.save();
    } catch (e) { console.error('Milestone journal error:', e.message); }

    // Refresh pool balance
    const fresh = await Account.findOne({ code: '1400' });
    bal = Number(fresh.balance) || 0;
  }
}

exports.checkPoolMilestone = checkPoolMilestone;

// ==================== GET POOL STATUS ====================
exports.getPoolStatus = async (req, res) => {
  try {
    const poolAcc = await Account.findOne({ code: '1400' });
    const balance = Number(poolAcc?.balance) || 0;

    const declarations = await ProfitDeclaration.find({ type: 'declaration' }).sort('-date').limit(50);
    const extractions = await ProfitDeclaration.find({ type: { $in: ['extraction', 'milestone'] } }).sort('-date').limit(50);

    const totalDeclared = await ProfitDeclaration.aggregate([
      { $match: { type: 'declaration', isReversed: false } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExtracted = await ProfitDeclaration.aggregate([
      { $match: { type: { $in: ['extraction', 'milestone'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      balance,
      totalDeclared: totalDeclared[0]?.total || 0,
      totalExtracted: totalExtracted[0]?.total || 0,
      recentDeclarations: declarations,
      recentExtractions: extractions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET FULL HISTORY ====================
exports.getPoolHistory = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const history = await ProfitDeclaration.find(filter).sort('-date').limit(500);
    res.json({ history, count: history.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PROFIT VS CAPITAL RATIO ====================
exports.getProfitVsCapitalRatio = async (req, res) => {
  try {
    const clubAcc = await Account.findOne({ code: '1000' });
    const savingsAcc = await Account.findOne({ code: '1010' });
    const poolAcc = await Account.findOne({ code: '1400' });

    const clubCapital = Number(clubAcc?.balance) || 0;
    const memberSavings = Number(savingsAcc?.balance) || 0;
    const pool = Number(poolAcc?.balance) || 0;

    // Total extracted from pool historically = profits credited to Club Capital
    const extracted = await ProfitDeclaration.aggregate([
      { $match: { type: { $in: ['extraction', 'milestone'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalBusinessProfit = extracted[0]?.total || 0;

    res.json({
      clubCapital,
      memberSavings,
      poolBalance: pool,
      totalBusinessProfitExtracted: totalBusinessProfit,
      profitPercentOfCapital: clubCapital > 0
        ? Math.round((totalBusinessProfit / clubCapital) * 10000) / 100
        : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MULTI-YEAR BUSINESS PROFIT TRACKING ====================
exports.getMultiYearProfit = async (req, res) => {
  try {
    const businesses = await Business.find({ isSystem: false });
    const result = [];

    for (const biz of businesses) {
      const declarations = await ProfitDeclaration.find({
        businessId: biz._id,
        type: 'declaration',
        isReversed: false
      });

      const byYear = {};
      for (const d of declarations) {
        const y = d.year || new Date(d.date).getFullYear();
        byYear[y] = (byYear[y] || 0) + Number(d.amount || 0);
      }

      result.push({
        businessId: biz._id,
        businessName: biz.name,
        byYear,
        totalDeclared: Object.values(byYear).reduce((s, x) => s + x, 0)
      });
    }

    res.json({ businesses: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REVERSE A DECLARATION ====================
exports.reverseDeclaration = async (req, res) => {
  try {
    const { reason, reversedBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Reason required' });

    const declaration = await ProfitDeclaration.findById(req.params.id);
    if (!declaration) return res.status(404).json({ error: 'Declaration not found' });
    if (declaration.isReversed) return res.status(400).json({ error: 'Already reversed' });
    if (declaration.type !== 'declaration') {
      return res.status(400).json({ error: 'Only original declarations can be reversed. Extractions must be handled separately.' });
    }

    const biz = await Business.findById(declaration.businessId);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const poolAcc = await Account.findOne({ code: '1400' });
    if (!poolAcc || Number(poolAcc.balance) < declaration.amount) {
      return res.status(400).json({ error: `Cannot reverse — insufficient pool balance to send back. Pool: UGX ${fmt(poolAcc?.balance || 0)}` });
    }

    // Reverse journal: Debit Business Fund / Credit Profit Pool
    try {
      await createJournalEntry({
        date: new Date(),
        description: `REVERSAL of ${declaration.declarationNumber} — ${reason}`,
        reference: declaration._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: biz.fundAccountCode || '1100', debit: declaration.amount },
          { accountCode: '1400', credit: declaration.amount }
        ],
        createdBy: reversedBy || 'admin'
      });
    } catch (e) { console.error('Reversal journal:', e.message); }

    // Restore business balance
    biz.currentBalance = (Number(biz.currentBalance) || 0) + declaration.amount;
    biz.totalProfitDeclared = Math.max(0, (Number(biz.totalProfitDeclared) || 0) - declaration.amount);
    await biz.save();

    declaration.isReversed = true;
    declaration.reversedAt = new Date();
    declaration.reversedBy = reversedBy || 'admin';
    declaration.reversalReason = reason;
    await declaration.save();

    res.json({ success: true, message: 'Declaration reversed', declaration, businessBalance: biz.currentBalance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};