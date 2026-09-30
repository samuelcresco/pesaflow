const mongoose = require('mongoose');

const ClubExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'other' },

  // NEW: who was paid
  payee: { type: String, default: '' },

  // NEW: who cashed out (staff who paid)
  cashier: { type: String, default: '' },

  // NEW: attached vendor receipt image (base64 or file path)
  receiptImage: { type: String, default: '' },

  // NEW: link to auto-generated payment voucher
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentVoucher', default: null },

  // NEW: for multi-entry grouping — same batchId = same submission
  batchId: { type: String, default: '' },

  date: { type: Date, required: true },
  month: { type: Number },
  year: { type: Number },
  paidTo: { type: String },
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdBy: { type: String }
}, { timestamps: true });

ClubExpenseSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('ClubExpense', ClubExpenseSchema);