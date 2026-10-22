const mongoose = require('mongoose');

const BulkBatchSchema = new mongoose.Schema({
  category: { type: String, enum: ['monthly', 'misc'], required: true },

  // NEW: mode & scope
  mode: { type: String, enum: ['single', 'all'], required: true },
  scope: { type: String, enum: ['month', 'year'], required: true },

  // month is null when scope === 'year'
  month: { type: Number, default: null },
  year: { type: Number, required: true },

  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'mobile_money'], default: 'cash' },
  description: { type: String, default: '' },

  // Per-record audit trail
  appliedTo: [{
    memberId: mongoose.Schema.Types.ObjectId,
    memberName: String,
    memberNumber: String,
    month: Number,
    year: Number,
    savingId: mongoose.Schema.Types.ObjectId,
    previousSavingIds: [mongoose.Schema.Types.ObjectId],
    previousAmount: Number
  }],

  createdCount: { type: Number, default: 0 },
  overwrittenCount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  createdBy: { type: String, default: 'admin' },

  reversed: { type: Boolean, default: false },
  reversedAt: { type: Date, default: null },
  reversedBy: { type: String, default: '' },
  reversalNotes: { type: String, default: '' }
}, { timestamps: true });

BulkBatchSchema.index({ year: -1, month: -1 });
BulkBatchSchema.index({ category: 1, year: 1, month: 1 });

module.exports = mongoose.model('BulkBatch', BulkBatchSchema);