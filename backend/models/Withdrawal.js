const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  memberName: { type: String, default: '' },
  memberNumber: { type: String, default: '' },

  // Which pocket the money comes from
  source: {
    type: String,
    enum: ['savings', 'dividends'],
    required: true
  },

  amount: { type: Number, required: true, min: 1 },

  // Withdrawal window it falls under
  period: {
    type: String,
    enum: ['june', 'december'],
    required: true
  },

  requestedDate: { type: Date, default: Date.now, index: true },
  approvedDate: { type: Date, default: null },
  paidDate: { type: Date, default: null },

  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'mobile_money', ''],
    default: ''
  },
  paymentReference: { type: String, default: '' }, // mobile money txn code, etc.

  requestedBy: { type: String, default: 'member' }, // member | admin
  approvedBy: { type: String, default: '' },
  paidBy: { type: String, default: '' },
  rejectedBy: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },

  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);