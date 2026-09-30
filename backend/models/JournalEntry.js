const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  entryNumber: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  description: { type: String, required: true },
  reference: { type: String }, // source ID (loan, business txn, dividend, etc.)
  sourceType: {
    type: String,
    enum: ['business', 'loan', 'dividend', 'investment', 'club_expense', 'shares', 'savings', 'manual'],
    required: true
  },
  lines: [{
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  }],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  createdBy: { type: String }
}, { timestamps: true });

// Validate that debits = credits
JournalEntrySchema.pre('save', function(next) {
  if (this.totalDebit !== this.totalCredit) {
    return next(new Error('Journal entry is not balanced: debits ≠ credits'));
  }
  next();
});

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);