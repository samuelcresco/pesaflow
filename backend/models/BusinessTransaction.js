const mongoose = require('mongoose');

const BusinessTransactionSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  type: {
    type: String,
    enum: ['capital_in', 'revenue', 'expense', 'loss', 'profit_extraction'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },

  // NEW: category for expense classification (transport, fuel, supplies, etc.)
  category: { type: String, default: '' },

  // NEW: who was paid (for expense tracking)
  payee: { type: String, default: '' },

  // NEW: who cashed out (staff who paid)
  cashier: { type: String, default: '' },

  // NEW: attached vendor receipt image (base64 or file path)
  receiptImage: { type: String, default: '' },

  // NEW: link to auto-generated payment voucher
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentVoucher', default: null },

  reference: { type: String },
  date: { type: Date, required: true },
  month: { type: Number },
  year: { type: Number },
  createdBy: { type: String },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' }
}, { timestamps: true });

BusinessTransactionSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('BusinessTransaction', BusinessTransactionSchema);