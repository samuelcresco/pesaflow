const mongoose = require('mongoose');

const ShareRequestSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  memberName: { type: String, required: true },
  memberNumber: { type: String, required: true },

  shareType: {
    type: String,
    enum: ['golden', 'platinum', 'silver', 'bronze'],
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },

  unitPrice: { type: Number, required: true },
  amountDue: { type: Number, required: true },

  paymentMethod: {
    type: String,
    enum: ['cash', 'savings'],
    default: 'cash'
  },

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

  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ShareRequest', ShareRequestSchema);