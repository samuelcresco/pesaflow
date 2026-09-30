const Dividend = require('../models/Dividend');
const Member = require('../models/Member');
const ShareSettings = require('../models/shareSettings.models');
const { createJournalEntry } = require('../utils/journalHelper');

// ==================== HELPER: get dividend percentages ====================
async function getDividendPercentages() {
  const shareSettings = await ShareSettings.findOne();
  const sp = shareSettings?.dividendPercentages || {
    ordinary: 10, silver: 20, golden: 30, platinum: 40
  };
  return {
    platinum: sp.platinum || 40,
    golden: sp.golden || 30,
    silver: sp.silver || 20,
    bronze: sp.ordinary || 10
  };
}

// ==================== DISTRIBUTE DIVIDENDS ====================
exports.distributeDividends = async (req, res) => {
  try {
    const { totalAmount, distributionDate, createdBy } = req.body;

 // ==================== WINDOW ENFORCEMENT ====================
    // Dividends can only be distributed December 1-15 (inclusive)
    const checkDate = distributionDate ? new Date(distributionDate) : new Date();
    const checkMonth = checkDate.getMonth() + 1; // 1-12
    const checkDay = checkDate.getDate();

    if (!(checkMonth === 12 && checkDay >= 1 && checkDay <= 15)) {
      return res.status(400).json({
        error: 'Dividends can only be distributed December 1–15. Admin can override by contacting support if a genuine exception is required.',
        currentDate: checkDate.toISOString().split('T')[0],
        allowedWindow: 'December 1 – December 15 (inclusive)'
      });
    }

    const pct = await getDividendPercentages();

    const members = await Member.find({ active: true });
    if (members.length === 0) throw new Error('No active members');

    // Total shares per type across all members
    const totals = {
      platinum: members.reduce((s, m) => s + (m.shares.platinum || 0), 0),
      golden: members.reduce((s, m) => s + (m.shares.golden || 0), 0),
      silver: members.reduce((s, m) => s + (m.shares.silver || 0), 0),
      bronze: members.reduce((s, m) => s + (m.shares.bronze || 0), 0)
    };

    // Pool per type
    const pools = {
      platinum: totalAmount * (pct.platinum / 100),
      golden: totalAmount * (pct.golden / 100),
      silver: totalAmount * (pct.silver / 100),
      bronze: totalAmount * (pct.bronze / 100)
    };

    const distributions = [];
    let totalDistributed = 0;

    for (const m of members) {
      const amtPlat = totals.platinum > 0 ? (pools.platinum * (m.shares.platinum || 0)) / totals.platinum : 0;
      const amtGold = totals.golden > 0 ? (pools.golden * (m.shares.golden || 0)) / totals.golden : 0;
      const amtSilv = totals.silver > 0 ? (pools.silver * (m.shares.silver || 0)) / totals.silver : 0;
      const amtBron = totals.bronze > 0 ? (pools.bronze * (m.shares.bronze || 0)) / totals.bronze : 0;
      const total = amtPlat + amtGold + amtSilv + amtBron;

      if (total > 0) {
        distributions.push({
          memberId: m._id,
          memberName: `${m.firstName} ${m.surname}`,
          memberNumber: m.memberNumber,
          platinumShares: m.shares.platinum || 0,
          goldenShares: m.shares.golden || 0,
          silverShares: m.shares.silver || 0,
          bronzeShares: m.shares.bronze || 0,
          amountFromPlatinum: Math.round(amtPlat * 100) / 100,
          amountFromGolden: Math.round(amtGold * 100) / 100,
          amountFromSilver: Math.round(amtSilv * 100) / 100,
          amountFromBronze: Math.round(amtBron * 100) / 100,
          totalAmount: Math.round(total * 100) / 100
        });

         m.savings += total;
        m.dividendBalance = (Number(m.dividendBalance) || 0) + total;
        m.totalDividendsReceived = (Number(m.totalDividendsReceived) || 0) + total;
        await m.save();

        totalDistributed += total;
      }
    }

    const distDate = distributionDate ? new Date(distributionDate) : new Date();

    const dividend = await Dividend.create({
      totalAmount,
      distributionDate: distDate,
      month: distDate.getMonth() + 1,
      year: distDate.getFullYear(),
      shareTypePercentages: pct,
      distributions,
      createdBy: createdBy || 'admin'
    });

    // Journal: Debit Club Capital / Credit Member Savings
    const journal = await createJournalEntry({
      date: distDate,
      description: `Dividend distribution of UGX ${totalAmount.toLocaleString()}`,
      reference: dividend._id.toString(),
      sourceType: 'dividend',
      lines: [
        { accountCode: '1000', debit: Math.round(totalDistributed * 100) / 100 },
        { accountCode: '1010', credit: Math.round(totalDistributed * 100) / 100 }
      ],
      createdBy: createdBy || 'admin'
    });

    dividend.journalEntryId = journal._id;
    await dividend.save();

    res.json({
      success: true,
      dividend,
      totalDistributed: Math.round(totalDistributed * 100) / 100,
      journal
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== PREVIEW DIVIDEND ====================
exports.previewDividend = async (req, res) => {
  try {
    const { totalAmount } = req.body;
    const pct = await getDividendPercentages();

    const members = await Member.find({ active: true });
    const totals = {
      platinum: members.reduce((s, m) => s + (m.shares.platinum || 0), 0),
      golden: members.reduce((s, m) => s + (m.shares.golden || 0), 0),
      silver: members.reduce((s, m) => s + (m.shares.silver || 0), 0),
      bronze: members.reduce((s, m) => s + (m.shares.bronze || 0), 0)
    };

    const pools = {
      platinum: totalAmount * (pct.platinum / 100),
      golden: totalAmount * (pct.golden / 100),
      silver: totalAmount * (pct.silver / 100),
      bronze: totalAmount * (pct.bronze / 100)
    };

    const preview = members.map(m => {
      const amtPlat = totals.platinum > 0 ? (pools.platinum * (m.shares.platinum || 0)) / totals.platinum : 0;
      const amtGold = totals.golden > 0 ? (pools.golden * (m.shares.golden || 0)) / totals.golden : 0;
      const amtSilv = totals.silver > 0 ? (pools.silver * (m.shares.silver || 0)) / totals.silver : 0;
      const amtBron = totals.bronze > 0 ? (pools.bronze * (m.shares.bronze || 0)) / totals.bronze : 0;
      const total = amtPlat + amtGold + amtSilv + amtBron;

      return {
        memberId: m._id,
        memberName: `${m.firstName} ${m.surname}`,
        memberNumber: m.memberNumber,
        platinumShares: m.shares.platinum || 0,
        goldenShares: m.shares.golden || 0,
        silverShares: m.shares.silver || 0,
        bronzeShares: m.shares.bronze || 0,
        amountFromPlatinum: Math.round(amtPlat * 100) / 100,
        amountFromGolden: Math.round(amtGold * 100) / 100,
        amountFromSilver: Math.round(amtSilv * 100) / 100,
        amountFromBronze: Math.round(amtBron * 100) / 100,
        totalAmount: Math.round(total * 100) / 100
      };
    });

    res.json({ preview, percentages: pct, pools, totals });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL DIVIDENDS ====================
exports.getAllDividends = async (req, res) => {
  try {
    const dividends = await Dividend.find().sort('-distributionDate');
    res.json(dividends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getDividendById = async (req, res) => {
  try {
    const dividend = await Dividend.findById(req.params.id);
    if (!dividend) return res.status(404).json({ error: 'Dividend not found' });
    res.json(dividend);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};