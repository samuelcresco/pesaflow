const mongoose = require('mongoose');

const ClubExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'other' },

  // 'club' deducts from Club Capital (1000)
  // 'loan' deducts from Loan Fund (1100) and counts against loan profit
  scope: { type: String, enum: ['club', 'loan'], default: 'club', index: true },

  payee: { type: String, default: '' },
  cashier: { type: String, default: '' },
  receiptImage: { type: String, default: '' },

  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentVoucher', default: null },
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