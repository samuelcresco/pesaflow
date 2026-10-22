const Dividend = require('../models/Dividend');
const Member = require('../models/Member');
const ShareSettings = require('../models/shareSettings.models');
const Saving = require('../models/Saving');
const Account = require('../models/Account');
const Withdrawal = require('../models/Withdrawal');
const Receipt = require('../models/Receipt');
const { createJournalEntry } = require('../utils/journalHelper');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const {
  getSettings,
  isWithinDividendWindow,
  getDividendWindowLabel
} = require('../utils/withdrawalHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

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

    const checkDate = distributionDate ? new Date(distributionDate) : new Date();
    const checkMonth = checkDate.getMonth() + 1;
    const checkDay = checkDate.getDate();

    if (!(checkMonth === 12 && checkDay >= 1 && checkDay <= 15)) {
      return res.status(400).json({
        error: 'Dividends can only be distributed December 1–15.',
        currentDate: checkDate.toISOString().split('T')[0],
        allowedWindow: 'December 1 – December 15 (inclusive)'
      });
    }

    const pct = await getDividendPercentages();

    const members = await Member.find({ active: true });
    if (members.length === 0) throw new Error('No active members');

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

        // ONLY add to dividendBalance — not savings
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

    // Journal: Debit Dividends Payable / Credit Club Capital (held in club)
    const journal = await createJournalEntry({
      date: distDate,
      description: `Dividend distribution of UGX ${fmt(totalAmount)}`,
      reference: dividend._id.toString(),
      sourceType: 'dividend',
      lines: [
        { accountCode: '1000', debit: Math.round(totalDistributed * 100) / 100 },
        { accountCode: '2000', credit: Math.round(totalDistributed * 100) / 100 }
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

// ==================== MEMBER: MY DIVIDEND SUMMARY ====================
exports.getMyDividendSummary = async (req, res) => {
  try {
    const memberId = req.params.id;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const pct = await getDividendPercentages();

    // Current club-wide totals
    const allMembers = await Member.find({ active: true });
    const clubTotals = {
      platinum: allMembers.reduce((s, m) => s + Number(m.shares?.platinum || 0), 0),
      golden: allMembers.reduce((s, m) => s + Number(m.shares?.golden || 0), 0),
      silver: allMembers.reduce((s, m) => s + Number(m.shares?.silver || 0), 0),
      bronze: allMembers.reduce((s, m) => s + Number(m.shares?.bronze || 0), 0)
    };

    // Reference pool: last distribution total, or 0
    const lastDividend = await Dividend.findOne().sort('-distributionDate');
    const referencePool = Number(lastDividend?.totalAmount || 0);

    const myShares = {
      platinum: Number(member.shares?.platinum || 0),
      golden: Number(member.shares?.golden || 0),
      silver: Number(member.shares?.silver || 0),
      bronze: Number(member.shares?.bronze || 0)
    };

    // Compute per-type breakdown against the reference pool
    const breakdown = ['platinum', 'golden', 'silver', 'bronze'].map(type => {
      const myQty = myShares[type];
      const clubQty = clubTotals[type];
      const poolPct = pct[type];
      const poolAmount = referencePool * (poolPct / 100);
      const myPct = clubQty > 0 ? (myQty / clubQty) * 100 : 0;
      const projected = clubQty > 0 ? (poolAmount * myQty) / clubQty : 0;

      return {
        type,
        myShares: myQty,
        clubShares: clubQty,
        myPercentOfType: Math.round(myPct * 100) / 100,
        poolPercent: poolPct,
        poolAmount: Math.round(poolAmount * 100) / 100,
        projectedDividend: Math.round(projected * 100) / 100
      };
    });

    const totalProjected = breakdown.reduce((s, b) => s + b.projectedDividend, 0);

    // Window status
    const settings = await getSettings();
    const dw = isWithinDividendWindow(new Date(), settings);
    const windowLabel = getDividendWindowLabel(settings);

    res.json({
      dividendBalance: Number(member.dividendBalance) || 0,
      totalDividendsReceived: Number(member.totalDividendsReceived) || 0,
      totalDividendsWithdrawn: Number(member.totalDividendsWithdrawn) || 0,
      savings: Number(member.savings) || 0,
      myShares,
      breakdown,
      totalProjected: Math.round(totalProjected * 100) / 100,
      referencePool,
      lastDistributionDate: lastDividend?.distributionDate || null,
      window: {
        open: dw.ok,
        label: windowLabel,
        enabled: !!settings.dividendWindowEnabled
      }
    });
  } catch (error) {
    console.error('getMyDividendSummary error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER: MY DIVIDEND HISTORY ====================
exports.getMyDividendHistory = async (req, res) => {
  try {
    const memberId = req.params.id;
    const dividends = await Dividend.find({ 'distributions.memberId': memberId })
      .sort('-distributionDate');

    const history = dividends.map(d => {
      const mine = d.distributions.find(x => x.memberId && x.memberId.toString() === memberId);
      return {
        _id: d._id,
        date: d.distributionDate,
        totalPool: d.totalAmount,
        percentages: d.shareTypePercentages,
        myShare: {
          platinumShares: mine?.platinumShares || 0,
          goldenShares: mine?.goldenShares || 0,
          silverShares: mine?.silverShares || 0,
          bronzeShares: mine?.bronzeShares || 0,
          fromPlatinum: mine?.amountFromPlatinum || 0,
          fromGolden: mine?.amountFromGolden || 0,
          fromSilver: mine?.amountFromSilver || 0,
          fromBronze: mine?.amountFromBronze || 0,
          total: mine?.totalAmount || 0
        }
      };
    });

    const total = history.reduce((s, h) => s + h.myShare.total, 0);
    res.json({ history, total: Math.round(total * 100) / 100 });
  } catch (error) {
    console.error('getMyDividendHistory error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER: USE DIVIDENDS ====================
exports.useDividends = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { action, amount, shareType, quantity } = req.body;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // ==================== DONATE TO CLUB ====================
    if (action === 'donate') {
      const amt = Number(amount) || 0;
      if (amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });
      if (amt > Number(member.dividendBalance)) {
        return res.status(400).json({ error: `Insufficient dividends. Available: UGX ${fmt(member.dividendBalance)}` });
      }

      member.dividendBalance = Number(member.dividendBalance) - amt;
      await member.save();

      // Account 1070 Donations
      let donAcc = await Account.findOne({ code: '1070' });
      if (!donAcc) {
        donAcc = await Account.create({ code: '1070', name: 'Donations', type: 'Equity', balance: amt });
      } else {
        donAcc.balance = (Number(donAcc.balance) || 0) + amt;
        await donAcc.save();
      }

      // Saving record for tracking
      try {
        await Saving.create({
          memberId: member._id,
          category: 'donation',
          donationType: 'member',
          amount: amt,
          description: 'Member donated dividends to club',
          date: new Date()
        });
      } catch (e) { console.error('donation Saving record:', e.message); }

      // Journal: Debit 2000 (Dividends Payable) / Credit 1070 (Donations)
      try {
        await createJournalEntry({
          date: new Date(),
          description: `Dividend donation — ${member.firstName} ${member.surname}`,
          sourceType: 'dividend',
          lines: [
            { accountCode: '2000', debit: amt },
            { accountCode: '1070', credit: amt }
          ]
        });
      } catch (e) { console.error('donation journal:', e.message); }

      // Receipt
      let receipt = null;
      try {
        const receiptNumber = await generateReceiptNumber(new Date());
        receipt = await Receipt.create({
          receiptNumber,
          type: 'savings_deposit',
          memberId: member._id,
          memberName: `${member.firstName} ${member.surname}`,
          memberNumber: member.memberNumber,
          amount: amt,
          description: 'Donated dividends to club',
          category: 'donation',
          date: new Date(),
          issuedBy: 'member',
          issuedByName: 'Member',
          status: 'issued'
        });
      } catch (e) { console.error('donation receipt:', e.message); }

      return res.json({
        success: true,
        message: `UGX ${fmt(amt)} donated to club. Thank you!`,
        newDividendBalance: member.dividendBalance,
        receipt: receipt ? { receiptNumber: receipt.receiptNumber } : null
      });
    }

    // ==================== ADD TO SAVINGS ====================
    if (action === 'to_savings') {
      const amt = Number(amount) || 0;
      if (amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });
      if (amt > Number(member.dividendBalance)) {
        return res.status(400).json({ error: `Insufficient dividends. Available: UGX ${fmt(member.dividendBalance)}` });
      }

      member.dividendBalance = Number(member.dividendBalance) - amt;
      member.savings = Number(member.savings) + amt;
      await member.save();

      // Saving record
      try {
        await Saving.create({
          memberId: member._id,
          category: 'extra',
          amount: amt,
          description: 'Moved dividends to savings',
          date: new Date()
        });
      } catch (e) { console.error('to_savings Saving record:', e.message); }

      // Journal: Debit 2000 / Credit 1010
      try {
        await createJournalEntry({
          date: new Date(),
          description: `Dividends → Savings — ${member.firstName} ${member.surname}`,
          sourceType: 'dividend',
          lines: [
            { accountCode: '2000', debit: amt },
            { accountCode: '1010', credit: amt }
          ]
        });
      } catch (e) { console.error('to_savings journal:', e.message); }

      return res.json({
        success: true,
        message: `UGX ${fmt(amt)} moved to your savings`,
        newDividendBalance: member.dividendBalance,
        newSavings: member.savings
      });
    }

    // ==================== BUY SHARES INSTANTLY ====================
    if (action === 'to_shares') {
      const qty = parseInt(quantity) || 0;
      if (!['golden', 'platinum', 'silver', 'bronze'].includes(shareType)) {
        return res.status(400).json({ error: 'Invalid share type' });
      }
      if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });

      const settings = await ShareSettings.findOne() || {};
      const settingsKey = { golden: 'golden', platinum: 'platinum', silver: 'silver', bronze: 'ordinary' }[shareType];
      const typeSettings = settings.shareTypes?.[settingsKey] || {};
      const unitPrice = Number(typeSettings.price) || 0;
      const maxPerType = Number(typeSettings.maxShares) || 15;

      if (unitPrice <= 0) return res.status(400).json({ error: 'Share price not configured' });

      const currentOfType = Number(member.shares?.[shareType] || 0);
      if (currentOfType + qty > maxPerType) {
        return res.status(400).json({ error: `Max ${maxPerType} ${shareType} shares per member. You have ${currentOfType}.` });
      }
      const totalShares = ['golden', 'platinum', 'silver', 'bronze']
        .reduce((s, k) => s + Number(member.shares?.[k] || 0), 0);
      if (totalShares + qty > 15) {
        return res.status(400).json({ error: `Total shares cannot exceed 15. You have ${totalShares}.` });
      }

      const amountDue = qty * unitPrice;
      if (amountDue > Number(member.dividendBalance)) {
        return res.status(400).json({ error: `Insufficient dividends. Need UGX ${fmt(amountDue)}, have UGX ${fmt(member.dividendBalance)}.` });
      }

      member.dividendBalance = Number(member.dividendBalance) - amountDue;
      if (!member.shares) member.shares = { golden: 0, platinum: 0, silver: 0, bronze: 0 };
      member.shares[shareType] = Number(member.shares[shareType] || 0) + qty;
      await member.save();

      // Bump Account 1030 Share Capital
      let shareAcc = await Account.findOne({ code: '1030' });
      if (!shareAcc) {
        shareAcc = await Account.create({ code: '1030', name: 'Share Capital', type: 'Equity', balance: amountDue });
      } else {
        shareAcc.balance = (Number(shareAcc.balance) || 0) + amountDue;
        await shareAcc.save();
      }

      // Saving record
      try {
        await Saving.create({
          memberId: member._id,
          category: 'shares',
          shareType,
          shareQuantity: qty,
          amount: amountDue,
          description: `${shareType} shares × ${qty} (paid from dividends)`,
          date: new Date()
        });
      } catch (e) { console.error('to_shares Saving record:', e.message); }

      // Journal: Debit 2000 / Credit 1030
      try {
        await createJournalEntry({
          date: new Date(),
          description: `Share purchase from dividends — ${member.firstName} ${member.surname}`,
          sourceType: 'dividend',
          lines: [
            { accountCode: '2000', debit: amountDue },
            { accountCode: '1030', credit: amountDue }
          ]
        });
      } catch (e) { console.error('to_shares journal:', e.message); }

      // Receipt
      let receipt = null;
      try {
        const receiptNumber = await generateReceiptNumber(new Date());
        receipt = await Receipt.create({
          receiptNumber,
          type: 'share_purchase',
          memberId: member._id,
          memberName: `${member.firstName} ${member.surname}`,
          memberNumber: member.memberNumber,
          amount: amountDue,
          description: `${shareType} shares × ${qty} (paid from dividends)`,
          category: 'shares',
          lineItems: [{
            label: `${shareType} Shares`,
            category: 'shares',
            amount: amountDue,
            description: `${qty} × UGX ${fmt(unitPrice)}`
          }],
          date: new Date(),
          issuedBy: 'member',
          issuedByName: 'Member',
          status: 'issued'
        });
      } catch (e) { console.error('to_shares receipt:', e.message); }

      return res.json({
        success: true,
        message: `Bought ${qty} ${shareType} shares for UGX ${fmt(amountDue)} from dividends`,
        newDividendBalance: member.dividendBalance,
        newShareCount: member.shares[shareType],
        receipt: receipt ? { receiptNumber: receipt.receiptNumber } : null
      });
    }

    // ==================== WITHDRAW TO CASH ====================
    if (action === 'withdraw') {
      const amt = Number(amount) || 0;
      if (amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });
      if (amt > Number(member.dividendBalance)) {
        return res.status(400).json({ error: `Insufficient dividends. Available: UGX ${fmt(member.dividendBalance)}` });
      }

      const settings = await getSettings();
      const dw = isWithinDividendWindow(new Date(), settings);
      if (!dw.ok) {
        return res.status(400).json({
          error: `Dividend withdrawals are only allowed ${getDividendWindowLabel(settings)}.`,
          windowLabel: getDividendWindowLabel(settings)
        });
      }

      // Create pending withdrawal (uses existing withdrawal flow)
      const withdrawal = await Withdrawal.create({
        memberId: member._id,
        memberName: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        source: 'dividends',
        amount: amt,
        period: dw.period || 'dividend_window',
        requestedDate: new Date(),
        status: 'pending',
        requestedBy: 'member',
        notes: 'Requested from member portal'
      });

      return res.json({
        success: true,
        message: `Withdrawal request of UGX ${fmt(amt)} submitted. Awaiting admin approval.`,
        withdrawal
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('useDividends error:', error.message);
    res.status(400).json({ error: error.message });
  }
};