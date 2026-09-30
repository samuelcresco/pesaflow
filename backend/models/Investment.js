const mongoose = require('mongoose');

const InvestmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'asset' }, // asset, land, property, etc.
  description: { type: String, default: '' },
  purchaseDate: { type: Date, required: true },
  purchaseCost: { type: Number, required: true },
  saleDate: { type: Date },
  salePrice: { type: Number },
  status: {
    type: String,
    enum: ['active', 'sold'],
    default: 'active'
  },
  memberContributions: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: String,
    amountContributed: Number,
    amountReturned: { type: Number, default: 0 }
  }],
  purchaseJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  saleJournalId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Investment', InvestmentSchema);