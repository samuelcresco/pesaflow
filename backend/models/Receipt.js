const mongoose = require('mongoose');

// ==================== LINE ITEM SCHEMA ====================
const LineItemSchema = new mongoose.Schema({
  label: { type: String, required: true },        // e.g. "Monthly Savings", "Golden Shares x 2"
  category: { type: String, default: '' },        // monthly, extra, misc, donation, penalty, membership, shares
  shareType: { type: String, default: '' },       // golden, platinum, silver, bronze (only for shares)
  quantity: { type: Number, default: 0 },         // for shares
  amount: { type: Number, required: true },       // line total
  description: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null }  // link to individual Saving doc
}, { _id: false });

// ==================== RECEIPT SCHEMA ====================
const ReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
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
      'multi_item'
    ],
    required: true,
    index: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    default: null
  },
  memberName: { type: String, default: '' },
  memberNumber: { type: String, default: '' },

  amount: { type: Number, required: true },        // grand total
  amountInWords: { type: String, default: '' },
  currency: { type: String, default: 'UGX' },

  description: { type: String, default: '' },
  category: { type: String, default: '' },

  // ==================== MULTI-ITEM SUPPORT ====================
  // For single-item receipts, lineItems will have exactly one entry.
  // For multi-item receipts, lineItems will have all items.
  lineItems: { type: [LineItemSchema], default: [] },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  referenceModel: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },

  date: { type: Date, required: true, default: Date.now, index: true },
  month: { type: Number },
  year: { type: Number },

  issuedBy: { type: String, default: 'admin' },
  issuedByName: { type: String, default: '' },

  status: {
    type: String,
    enum: ['issued', 'cancelled'],
    default: 'issued',
    index: true
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  notes: { type: String, default: '' }
}, { timestamps: true });

ReceiptSchema.pre('save', function (next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('Receipt', ReceiptSchema);