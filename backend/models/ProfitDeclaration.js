const mongoose = require('mongoose');

const ProfitDeclarationSchema = new mongoose.Schema({
  declarationNumber: { type: String, required: true, unique: true, index: true },

  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  businessName: { type: String, required: true },

  amount: { type: Number, required: true, min: 1 },
  businessBalanceBefore: { type: Number, default: 0 },
  businessBalanceAfter: { type: Number, default: 0 },

  type: {
    type: String,
    enum: ['declaration', 'extraction', 'milestone', 'reversal'],
    default: 'declaration',
    index: true
  },

  // For extractions: which declaration(s) is it drawing from?
  relatedDeclarationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProfitDeclaration' }],

  // For milestones: auto vs manual
  isAutoMilestone: { type: Boolean, default: false },

  // Reversal tracking
  isReversed: { type: Boolean, default: false },
  reversedAt: { type: Date, default: null },
  reversedBy: { type: String, default: '' },
  reversalReason: { type: String, default: '' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfitDeclaration', default: null },

  notes: { type: String, default: '' },
  declaredBy: { type: String, default: 'admin' },
  date: { type: Date, default: Date.now, index: true },
  month: { type: Number },
  year: { type: Number },

  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null }
}, { timestamps: true });

ProfitDeclarationSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('ProfitDeclaration', ProfitDeclarationSchema);