const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },

  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  memberName: { type: String, required: true },
  memberNumber: { type: String, required: true },

  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'UGX' },

  description: { type: String, default: '' },
  category: { type: String, default: '' },

  lineItems: [{
    label: { type: String, required: true },
    category: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' }
  }],

  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  referenceModel: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },

  date: { type: Date, default: Date.now },

  issuedBy: { type: String, default: 'admin' },
  issuedByName: { type: String, default: '' },

  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['issued', 'cancelled'],
    default: 'issued'
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  type: {
    type: String,
    enum: [
      'savings_deposit',
      'savings_withdrawal',
      'share_purchase',
      'membership_fee',
      'loan_disbursement',
      'loan_repayment',
      'dividend',
      'penalty',
      'external_donation',
      'club_expense',
      'fund_transfer',
      'multi_item',
      'constitution_fee'
    ],
    default: 'savings_deposit'
  }
}, { timestamps: true });

module.exports = mongoose.model('Receipt', ReceiptSchema);