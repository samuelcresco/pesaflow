const Investment = require('../models/Investment');
const Member = require('../models/Member');
const { createJournalEntry } = require('../utils/journalHelper');

// ==================== BUY ASSET ====================
exports.buyAsset = async (req, res) => {
  try {
    const { name, type, description, purchaseDate, purchaseCost, createdBy } = req.body;

    const members = await Member.find({ active: true });
    if (members.length === 0) throw new Error('No active members');

    const sharePerMember = purchaseCost / members.length;

    // Check each member has enough AVAILABLE savings
    for (const m of members) {
      const available = m.savings - m.lockedSavings;
      if (available < sharePerMember) {
        throw new Error(
          `${m.firstName} ${m.surname} has insufficient available savings. ` +
          `Available: ${available.toFixed(2)}, Required: ${sharePerMember.toFixed(2)}`
        );
      }
    }

    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();

    const contributions = [];
    for (const m of members) {
      m.savings -= sharePerMember;
      await m.save();
      contributions.push({
        memberId: m._id,
        memberName: `${m.firstName} ${m.surname}`,
        amountContributed: Math.round(sharePerMember * 100) / 100
      });
    }

    const investment = await Investment.create({
      name,
      type: type || 'asset',
      description,
      purchaseDate: pDate,
      purchaseCost,
      memberContributions: contributions,
      createdBy: createdBy || 'admin'
    });

    // Journal: Debit Club Investments / Credit Member Savings
    const journal = await createJournalEntry({
      date: pDate,
      description: `Purchase of asset: ${name}`,
      reference: investment._id.toString(),
      sourceType: 'investment',
      lines: [
        { accountCode: '1200', debit: purchaseCost },
        { accountCode: '1010', credit: purchaseCost }
      ],
      createdBy: createdBy || 'admin'
    });

    investment.purchaseJournalId = journal._id;
    await investment.save();

    res.status(201).json({
      success: true,
      investment,
      sharePerMember: Math.round(sharePerMember * 100) / 100,
      membersCount: members.length,
      journal
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== SELL ASSET ====================
exports.sellAsset = async (req, res) => {
  try {
    const { saleDate, salePrice, createdBy } = req.body;
    const investment = await Investment.findById(req.params.id);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    if (investment.status === 'sold') throw new Error('Asset already sold');

    const members = await Member.find({ active: true });
    if (members.length === 0) throw new Error('No active members');

    const sharePerMember = salePrice / members.length;

    for (const m of members) {
      m.savings += sharePerMember;
      await m.save();
    }

    // Update contributions with return
    investment.memberContributions.forEach(c => {
      c.amountReturned = Math.round(sharePerMember * 100) / 100;
    });

    investment.saleDate = saleDate ? new Date(saleDate) : new Date();
    investment.salePrice = salePrice;
    investment.status = 'sold';

    // Journal: Debit Member Savings / Credit Club Investments
    const journal = await createJournalEntry({
      date: investment.saleDate,
      description: `Sale of asset: ${investment.name}`,
      reference: investment._id.toString(),
      sourceType: 'investment',
      lines: [
        { accountCode: '1010', debit: salePrice },
        { accountCode: '1200', credit: salePrice }
      ],
      createdBy: createdBy || 'admin'
    });

    investment.saleJournalId = journal._id;
    await investment.save();

    res.json({
      success: true,
      investment,
      sharePerMember: Math.round(sharePerMember * 100) / 100,
      journal
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL INVESTMENTS ====================
exports.getAllInvestments = async (req, res) => {
  try {
    const investments = await Investment.find().sort('-purchaseDate');
    res.json(investments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getInvestmentById = async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    res.json(investment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};