const express = require('express');
const router = express.Router();
const Transaction = require('../models/transactions.models');
const Account = require('../models/accounts.models');
const User = require('../models/users.models');

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      memberNumber, 
      status, 
      type, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    const query = {};
    
    // Filters
    if (memberNumber) {
      query.memberNumber = memberNumber.toUpperCase();
    }
    
    if (status) {
      query.status = status.toLowerCase();
    }
    
    if (type) {
      query.type = type.toLowerCase();
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    
    const transactions = await Transaction.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1, createdAt: -1 })
      .select('-__v');
      
    const total = await Transaction.countDocuments(query);
    
    // Calculate summary statistics
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          completedTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalDeposits: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$type', 'deposit'] },
                  { $eq: ['$status', 'completed'] }
                ]}, 
                '$amount', 
                0
              ]
            }
          },
          totalWithdrawals: {
            $sum: { 
              $cond: [
                { $and: [
                  { $eq: ['$type', 'withdrawal'] },
                  { $eq: ['$status', 'completed'] }
                ]}, 
                '$amount', 
                0
              ]
            }
          }
        }
      }
    ]);
    
    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalTransactions: total,
      summary: summary[0] || {
        totalAmount: 0,
        completedTransactions: 0,
        pendingTransactions: 0,
        totalDeposits: 0,
        totalWithdrawals: 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch transactions', 
      details: error.message 
    });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.id.toUpperCase() 
    }).select('-__v');
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch transaction', 
      details: error.message 
    });
  }
});

// Create new transaction
router.post('/', async (req, res) => {
  try {
    const {
      transactionId,
      memberNumber,
      date,
      type,
      amount,
      status,
      accountBalance,
      confirmedBy,
      description,
      reference,
      category
    } = req.body;

    if (!memberNumber || !type || amount == null) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'memberNumber, type, and amount are required'
      });
    }

    // Verify user exists
    const user = await User.findOne({ 
      memberNumber: memberNumber.toUpperCase() 
    });
    
    if (!user) {
      return res.status(400).json({ 
        error: 'User not found',
        details: 'Member must be registered first'
      });
    }

    // Verify account exists
    const account = await Account.findOne({ 
      memberNumber: memberNumber.toUpperCase() 
    });
    
    if (!account) {
      return res.status(400).json({ 
        error: 'Account not found',
        details: 'Account must be created first'
      });
    }

    // Generate transaction ID if not provided
    const finalTransactionId = transactionId || Transaction.generateTransactionId();

    // Check if transaction ID already exists
    if (transactionId) {
      const existingTransaction = await Transaction.findOne({ 
        transactionId: finalTransactionId.toUpperCase() 
      });
      
      if (existingTransaction) {
        return res.status(400).json({ 
          error: 'Transaction already exists',
          details: 'Transaction ID must be unique'
        });
      }
    }

    const newTransaction = new Transaction({
      transactionId: finalTransactionId,
      memberNumber,
      date: date || new Date(),
      type,
      amount,
      status: status || 'pending',
      accountBalance: accountBalance || account.savings,
      confirmedBy,
      description,
      reference,
      category
    });

    const savedTransaction = await newTransaction.save();
    
    // Update account balance if transaction is completed
    if (savedTransaction.status === 'completed') {
      if (type === 'deposit' || type === 'contribution') {
        await account.updateBalance(amount, 'credit');
      } else if (type === 'withdrawal') {
        await account.updateBalance(amount, 'debit');
      }
    }

    res.status(201).json(savedTransaction);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to create transaction', 
      details: error.message 
    });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const { 
      memberNumber, 
      date, 
      type, 
      amount, 
      status, 
      accountBalance, 
      confirmedBy,
      description,
      reference,
      category
    } = req.body;
    
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.id.toUpperCase() 
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Store old values for balance adjustment
    const oldStatus = transaction.status;
    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { transactionId: req.params.id.toUpperCase() },
      {
        memberNumber,
        date,
        type,
        amount,
        status,
        accountBalance,
        confirmedBy,
        description,
        reference,
        category
      },
      { 
        new: true, 
        runValidators: true,
        omitUndefined: true
      }
    ).select('-__v');

    // Update account balance if status changed to completed
    if (updatedTransaction.memberNumber) {
      const account = await Account.findOne({ 
        memberNumber: updatedTransaction.memberNumber.toUpperCase() 
      });
      
      if (account) {
        // Reverse old transaction if it was completed
        if (oldStatus === 'completed') {
          if (oldType === 'deposit' || oldType === 'contribution') {
            await account.updateBalance(oldAmount, 'debit');
          } else if (oldType === 'withdrawal') {
            await account.updateBalance(oldAmount, 'credit');
          }
        }
        
        // Apply new transaction if completed
        if (updatedTransaction.status === 'completed') {
          if (updatedTransaction.type === 'deposit' || updatedTransaction.type === 'contribution') {
            await account.updateBalance(updatedTransaction.amount, 'credit');
          } else if (updatedTransaction.type === 'withdrawal') {
            await account.updateBalance(updatedTransaction.amount, 'debit');
          }
        }
      }
    }

    res.json(updatedTransaction);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to update transaction', 
      details: error.message 
    });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.id.toUpperCase() 
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Reverse transaction if it was completed
    if (transaction.status === 'completed') {
      const account = await Account.findOne({ 
        memberNumber: transaction.memberNumber 
      });
      
      if (account) {
        if (transaction.type === 'deposit' || transaction.type === 'contribution') {
          await account.updateBalance(transaction.amount, 'debit');
        } else if (transaction.type === 'withdrawal') {
          await account.updateBalance(transaction.amount, 'credit');
        }
      }
    }
    
    const deletedTransaction = await Transaction.findOneAndDelete({ 
      transactionId: req.params.id.toUpperCase() 
    });

    res.json({ 
      message: 'Transaction deleted successfully', 
      transaction: deletedTransaction 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete transaction', 
      details: error.message 
    });
  }
});

// Complete/approve transaction
router.patch('/:id/complete', async (req, res) => {
  try {
    const { confirmedBy } = req.body;
    
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.id.toUpperCase() 
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status === 'completed') {
      return res.status(400).json({ 
        error: 'Transaction already completed' 
      });
    }
    
    // Update account balance
    const account = await Account.findOne({ 
      memberNumber: transaction.memberNumber 
    });
    
    if (!account) {
      return res.status(400).json({ 
        error: 'Account not found' 
      });
    }
    
    try {
      if (transaction.type === 'deposit' || transaction.type === 'contribution') {
        await account.updateBalance(transaction.amount, 'credit');
      } else if (transaction.type === 'withdrawal') {
        await account.updateBalance(transaction.amount, 'debit');
      }
      
      await transaction.complete(confirmedBy);
      
      res.json({ 
        message: 'Transaction completed successfully', 
        transaction,
        newAccountBalance: account.savings
      });
    } catch (balanceError) {
      return res.status(400).json({ 
        error: balanceError.message 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to complete transaction', 
      details: error.message 
    });
  }
});

// Get transactions by member number
router.get('/member/:memberNumber', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const query = { memberNumber: req.params.memberNumber.toUpperCase() };
    
    if (status) query.status = status.toLowerCase();
    if (type) query.type = type.toLowerCase();
    
    const transactions = await Transaction.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 })
      .select('-__v');
      
    const total = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalTransactions: total
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch member transactions', 
      details: error.message 
    });
  }
});

module.exports = router;
