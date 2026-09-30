const express = require('express');
const router = express.Router();
const Account = require('../models/accounts.models');
const User = require('../models/users.models');

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};
    
    // Status filter
    if (status) {
      query.accountStatus = status.toLowerCase();
    }
    
    // Search functionality
    if (search) {
      query.memberNumber = { $regex: search, $options: 'i' };
    }
    
    const accounts = await Account.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .select('-__v');
      
    const total = await Account.countDocuments(query);
    
    // Calculate summary statistics
    const summary = await Account.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSavings: { $sum: '$savings' },
          totalShares: { $sum: '$sharesOwned' },
          totalContributions: { $sum: '$monthlyContribution' },
          activeAccounts: {
            $sum: { $cond: [{ $eq: ['$accountStatus', 'active'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      accounts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalAccounts: total,
      summary: summary[0] || {
        totalSavings: 0,
        totalShares: 0,
        totalContributions: 0,
        activeAccounts: 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch accounts', 
      details: error.message 
    });
  }
});

// Get account by member number
router.get('/:id', async (req, res) => {
  try {
    const account = await Account.findOne({ 
      memberNumber: req.params.id.toUpperCase() 
    }).select('-__v');
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch account', 
      details: error.message 
    });
  }
});

// Create a new account
router.post('/', async (req, res) => {
  try {
    const { memberNumber, savings, monthlyContribution, sharesOwned, accountStatus, notes } = req.body;

    if (!memberNumber) {
      return res.status(400).json({ error: 'Member number is required' });
    }

    // Check if user exists
    const user = await User.findOne({ 
      memberNumber: memberNumber.toUpperCase() 
    });
    
    if (!user) {
      return res.status(400).json({ 
        error: 'User not found', 
        details: 'Member must be registered as a user first' 
      });
    }

    // Check if account already exists
    const existingAccount = await Account.findOne({ 
      memberNumber: memberNumber.toUpperCase() 
    });
    
    if (existingAccount) {
      return res.status(400).json({ 
        error: 'Account already exists', 
        details: 'Account for this member number already exists' 
      });
    }

    const newAccount = new Account({
      memberNumber,
      savings: savings || 0,
      monthlyContribution: monthlyContribution || 0,
      sharesOwned: sharesOwned || 0,
      accountStatus: accountStatus || 'pending',
      notes
    });

    const savedAccount = await newAccount.save();
    res.status(201).json(savedAccount);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to create account', 
      details: error.message 
    });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const { savings, monthlyContribution, sharesOwned, accountStatus, notes } = req.body;
    
    const updatedAccount = await Account.findOneAndUpdate(
      { memberNumber: req.params.id.toUpperCase() },
      {
        savings,
        monthlyContribution,
        sharesOwned,
        accountStatus,
        notes,
        lastTransactionDate: new Date()
      },
      { 
        new: true, 
        runValidators: true,
        omitUndefined: true
      }
    ).select('-__v');

    if (!updatedAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(updatedAccount);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to update account', 
      details: error.message 
    });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const deletedAccount = await Account.findOneAndDelete({ 
      memberNumber: req.params.id.toUpperCase() 
    });

    if (!deletedAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ 
      message: 'Account deleted successfully', 
      account: deletedAccount 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete account', 
      details: error.message 
    });
  }
});

// Update account balance (credit/debit)
router.patch('/:id/balance', async (req, res) => {
  try {
    const { amount, type, description } = req.body;
    
    if (!amount || !type) {
      return res.status(400).json({ 
        error: 'Amount and type are required',
        details: 'Type must be "credit" or "debit"'
      });
    }
    
    if (type !== 'credit' && type !== 'debit') {
      return res.status(400).json({ 
        error: 'Invalid transaction type',
        details: 'Type must be "credit" or "debit"'
      });
    }

    const account = await Account.findOne({ 
      memberNumber: req.params.id.toUpperCase() 
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    try {
      await account.updateBalance(amount, type);
      res.json({ 
        message: `Account ${type}ed successfully`, 
        account,
        newBalance: account.savings
      });
    } catch (balanceError) {
      return res.status(400).json({ 
        error: balanceError.message 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update balance', 
      details: error.message 
    });
  }
});

// Get account statement/summary
router.get('/:id/summary', async (req, res) => {
  try {
    const account = await Account.findOne({ 
      memberNumber: req.params.id.toUpperCase() 
    }).select('-__v');
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get user details
    const user = await User.findOne({ 
      memberNumber: req.params.id.toUpperCase() 
    }).select('fname lname email phoneNumber');
    
    const summary = {
      account,
      user,
      totalValue: account.totalValue,
      accountAge: Math.floor((new Date() - account.accountOpenDate) / (1000 * 60 * 60 * 24)),
      lastActivity: account.lastTransactionDate
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch account summary', 
      details: error.message 
    });
  }
});

module.exports = router;
