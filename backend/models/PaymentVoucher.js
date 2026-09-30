const mongoose = require('mongoose');

const VoucherLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category: { type: String, default: '' },
  amount: { type: Number, required: true },
  sourceModel: { type: String, default: '' }, // ClubExpense | BusinessTransaction
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { _id: false });

const PaymentVoucherSchema = new mongoose.Schema({
  voucherNumber: { type: String, required: true, unique: true, index: true },

  // Which "side" — club or business
  voucherFor: {
    type: String,
    enum: ['club', 'business'],
    required: true,
    index: true
  },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  businessName: { type: String, default: '' },

  // Payee & cashier
  payee: { type: String, required: true },
  cashier: { type: String, default: '' },

  // Multi-line support
  lineItems: { type: [VoucherLineSchema], default: [] },

  totalAmount: { type: Number, required: true },

  // Batch grouping (if multiple expenses submitted together)
  batchId: { type: String, default: '' },

  date: { type: Date, required: true, default: Date.now, index: true },
  month: { type: Number },
  year: { type: Number },

  notes: { type: String, default: '' },

  // Attachment
  receiptImage: { type: String, default: '' },

   status: {
    type: String,
    enum: ['issued', 'cancelled', 'deleted'],
    default: 'issued',
    index: true
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },
deletedReason: { type: String, default: '' },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: '' },
  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  issuedBy: { type: String, default: 'admin' }
}, { timestamps: true });

PaymentVoucherSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('PaymentVoucher', PaymentVoucherSchema);