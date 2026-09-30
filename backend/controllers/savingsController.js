const Member = require('../models/Member');
const ClubCapital = require('../models/ClubCapital');
const Setting = require('../models/Setting');
const Investment = require('../models/Investment');

// Add monthly savings to all members
exports.addMonthlySavings = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const amount = settings?.monthlySavingsAmount || 0;
    if (amount <= 0) return res.status(400).json({ error: 'Monthly savings amount not set' });

    const members = await Member.find({ active: true });
    for (const member of members) {
      member.savings += amount;
      await member.save();
    }

    res.json({ 
      success: true, 
      message: `Added ${amount} to all members`, 
      membersUpdated: members.length 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add extra savings for a specific member
exports.addExtraSavings = async (req, res) => {
  try {
    const { memberId, amount, description } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.extraSavings += amount;
    member.savings += amount;
    await member.save();

    res.json({ success: true, member });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add penalty (goes to club capital)
exports.addPenalty = async (req, res) => {
  try {
    const { memberId, amount, description } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.penalties += amount;
    await member.save();

    let capital = await ClubCapital.findOne();
    if (!capital) capital = await ClubCapital.create({ balance: 0, transactions: [] });
    capital.balance += amount;
    capital.transactions.push({
      type: 'penalty',
      amount,
      description: description || `Penalty for ${member.name}`,
      memberId: member._id,
      date: new Date()
    });
    await capital.save();

    res.json({ success: true, member, clubCapital: capital.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buy shares (goes to club capital)
exports.buyShares = async (req, res) => {
  try {
    const { memberId, shareType, quantity, pricePerShare } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const totalCost = quantity * pricePerShare;
    if (member.savings < totalCost) {
      return res.status(400).json({ error: 'Insufficient savings' });
    }

    member.savings -= totalCost;
    member.shares[shareType] = (member.shares[shareType] || 0) + quantity;
    await member.save();

    let capital = await ClubCapital.findOne();
    if (!capital) capital = await ClubCapital.create({ balance: 0, transactions: [] });
    capital.balance += totalCost;
    capital.transactions.push({
      type: 'share_purchase',
      amount: totalCost,
      description: `${quantity} ${shareType} shares bought by ${member.name}`,
      memberId: member._id,
      date: new Date()
    });
    await capital.save();

    res.json({ success: true, member, clubCapital: capital.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add membership fee (goes to club capital)
exports.addMembershipFee = async (req, res) => {
  try {
    const { memberId, amount } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.membershipFeePaid += amount;
    await member.save();

    let capital = await ClubCapital.findOne();
    if (!capital) capital = await ClubCapital.create({ balance: 0, transactions: [] });
    capital.balance += amount;
    capital.transactions.push({
      type: 'membership_fee',
      amount,
      description: `Membership fee from ${member.name}`,
      memberId: member._id,
      date: new Date()
    });
    await capital.save();

    res.json({ success: true, member, clubCapital: capital.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add donation (goes to club capital)
exports.addDonation = async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    let capital = await ClubCapital.findOne();
    if (!capital) capital = await ClubCapital.create({ balance: 0, transactions: [] });
    capital.balance += amount;
    capital.transactions.push({
      type: 'donation',
      amount,
      description: description || 'Donation received',
      date: new Date()
    });
    await capital.save();

    res.json({ success: true, clubCapital: capital.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add miscellaneous (goes to club capital)
exports.addMiscellaneous = async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    let capital = await ClubCapital.findOne();
    if (!capital) capital = await ClubCapital.create({ balance: 0, transactions: [] });
    capital.balance += amount;
    capital.transactions.push({
      type: 'miscellaneous',
      amount,
      description: description || 'Miscellaneous income',
      date: new Date()
    });
    await capital.save();

    res.json({ success: true, clubCapital: capital.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all members with their savings
exports.getMemberSavings = async (req, res) => {
  try {
    const members = await Member.find({ active: true }).sort('name');
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get member transaction history
exports.getMemberTransactions = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    res.json({ 
      member: {
        name: member.name,
        memberNumber: member.memberNumber,
        savings: member.savings,
        extraSavings: member.extraSavings,
        penalties: member.penalties,
        membershipFeePaid: member.membershipFeePaid,
        totalDividendsReceived: member.totalDividendsReceived,
        shares: member.shares
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Purchase land/asset (equal deduction from all active members)
exports.purchaseInvestment = async (req, res) => {
  try {
    const { name, type, purchasePrice, description } = req.body;
    const members = await Member.find({ active: true });
    if (members.length === 0) return res.status(400).json({ error: 'No active members' });

    const perMember = purchasePrice / members.length;
    
    const investmentMembers = [];
    for (const member of members) {
      if (member.savings < perMember) {
        return res.status(400).json({ error: `${member.name} has insufficient savings` });
      }
      member.savings -= perMember;
      await member.save();
      investmentMembers.push({
        memberId: member._id,
        amountDeducted: perMember,
        amountAdded: 0
      });
    }

    const investment = new Investment({
      name,
      type: type || 'land',
      purchasePrice,
      totalMembers: members.length,
      members: investmentMembers,
      status: 'owned',
      description
    });
    await investment.save();

    res.json({ success: true, investment, perMember });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Sell investment (equal addition to all members)
exports.sellInvestment = async (req, res) => {
  try {
    const { salePrice } = req.body;
    const investment = await Investment.findById(req.params.id);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    if (investment.status === 'sold') return res.status(400).json({ error: 'Already sold' });

    const members = await Member.find({ active: true });
    const perMember = salePrice / members.length;

    for (const member of members) {
      member.savings += perMember;
      await member.save();
    }

    investment.salePrice = salePrice;
    investment.saleDate = new Date();
    investment.status = 'sold';
    for (const m of investment.members) {
      m.amountAdded = perMember;
    }
    await investment.save();

    res.json({ success: true, investment, perMember });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all investments
exports.getInvestments = async (req, res) => {
  try {
    const investments = await Investment.find().populate('members.memberId', 'name');
    res.json(investments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};