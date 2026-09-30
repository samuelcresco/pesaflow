const mongoose = require('mongoose');

const SavingsSchema = new mongoose.Schema({
  memberNumber: {
    type: String,
    required: true,
    ref: 'User'
  },
  memberName: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  miscDeduction: {
    type: Number,
    default: 5000
  },
  netAmount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['savings', 'asset_purchase', 'asset_sale', 'expense', 'penalty', 'membership_fee', 'shares_bought'],
    default: 'savings'
  },
  recordedBy: {
    type: String,
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Savings', SavingsSchema);