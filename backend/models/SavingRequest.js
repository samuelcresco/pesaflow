const mongoose = require('mongoose');

const SavingRequestSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  memberName: { type: String, required: true },
  memberNumber: { type: String, required: true },

  category: {
    type: String,
    enum: ['monthly', 'extra', 'misc', 'penalty'],
    required: true
  },
  amount: { type: Number, required: true, min: 1 },
  note: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },

  requestedAt: { type: Date, default: Date.now, index: true },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  rejectedReason: { type: String, default: '' },

  savingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Saving', default: null },
  receiptNumber: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SavingRequest', SavingRequestSchema);