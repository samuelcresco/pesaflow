const ClubCapital = require('../models/ClubCapital');
const Member = require('../models/Member');
const Business = require('../models/Business');

exports.getBalance = async (req, res) => {
  try {
    let capital = await ClubCapital.findOne();
    if (!capital) {
      capital = await ClubCapital.create({ balance: 0, transactions: [] });
    }
    res.json({ balance: capital.balance, transactions: capital.transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const { type, amount, description, memberId, businessId } = req.body;
    let capital = await ClubCapital.findOne();
    if (!capital) {
      capital = await ClubCapital.create({ balance: 0, transactions: [] });
    }

    const transaction = {
      type,
      amount,
      description,
      memberId,
      businessId,
      date: new Date()
    };

    if (['penalty', 'share_purchase', 'membership_fee', 'donation', 'business_profit', 'miscellaneous'].includes(type)) {
      capital.balance += amount;
    } else if (type === 'capital_to_business') {
      if (capital.balance < amount) throw new Error('Insufficient club capital');
      capital.balance -= amount;
    } else if (type === 'capital_returned') {
      capital.balance += amount;
    } else if (type === 'dividend_payment') {
      if (capital.balance < amount) throw new Error('Insufficient club capital for dividends');
      capital.balance -= amount;
    }

    capital.transactions.push(transaction);
    await capital.save();

    res.json({ success: true, balance: capital.balance, transaction });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const capital = await ClubCapital.findOne();
    if (!capital) return res.json({ transactions: [] });
    res.json(capital.transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};