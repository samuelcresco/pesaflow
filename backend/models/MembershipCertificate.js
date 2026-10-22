const mongoose = require('mongoose');

const MembershipCertificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true, index: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  memberName: { type: String, required: true },
  memberNumber: { type: String, required: true },

  year: { type: Number, required: true, index: true },
  membershipType: {
    type: String,
    enum: ['first_time', 'renewal'],
    default: 'renewal'
  },
  feePaid: { type: Number, required: true, default: 0 },
  paymentSource: {
    type: String,
    enum: ['savings', 'cash', 'manual', 'debt_cleared'],
    default: 'manual'
  },

  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },

  issueDate: { type: Date, default: Date.now, index: true },
  issuedBy: { type: String, default: 'system' },

  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active',
    index: true
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('MembershipCertificate', MembershipCertificateSchema);