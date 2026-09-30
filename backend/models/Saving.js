const mongoose = require('mongoose');

const SavingSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    default: null
  },
  category: {
    type: String,
    enum: ['monthly', 'extra', 'misc', 'donation', 'penalty', 'business_profit', 'shares', 'membership'],
    required: true
  },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  donorName: { type: String, default: '' },
  donationType: { type: String, enum: ['', 'member', 'external'], default: '' },
  membershipType: { type: String, enum: ['', 'first_time', 'renewal'], default: '' },
  month: { type: String },
  shareType: { type: String },
  shareQuantity: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },

  reversed: { type: Boolean, default: false },
  reversedAt: { type: Date, default: null },
  reversalReason: { type: String, default: '' },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Saving', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Saving', SavingSchema);