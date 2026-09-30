const mongoose = require('mongoose');

const ShareCertificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true, index: true },

  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  memberName: { type: String, required: true },
  memberNumber: { type: String, required: true },

  // Snapshot of shares at issue time
  shares: {
    golden:   { qty: { type: Number, default: 0 }, price: { type: Number, default: 0 }, value: { type: Number, default: 0 } },
    platinum: { qty: { type: Number, default: 0 }, price: { type: Number, default: 0 }, value: { type: Number, default: 0 } },
    silver:   { qty: { type: Number, default: 0 }, price: { type: Number, default: 0 }, value: { type: Number, default: 0 } },
    bronze:   { qty: { type: Number, default: 0 }, price: { type: Number, default: 0 }, value: { type: Number, default: 0 } }
  },

  totalQuantity: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },

  issueDate: { type: Date, default: Date.now, index: true },
  issuedBy: { type: String, default: 'admin' },

  status: {
    type: String,
    enum: ['issued', 'cancelled'],
    default: 'issued',
    index: true
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ShareCertificate', ShareCertificateSchema);