const mongoose = require('mongoose');

const LetterSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      // Letters
      'appointment', 'recommendation', 'good_standing', 'general',
      // Cards
      'invitation', 'success', 'wedding', 'introduction', 'condolence'
    ],
    required: true,
    index: true
  },
  referenceNumber: { type: String, required: true, unique: true, index: true },
  date: { type: Date, default: Date.now, required: true },

  recipient: {
    name: { type: String, default: '' },
    title: { type: String, default: '' },
    organization: { type: String, default: '' },
    address: { type: String, default: '' },
    salutation: { type: String, default: 'Dear Sir/Madam' }
  },

  subject: { type: String, required: true },
  body: { type: [String], default: [] },

  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leader', default: null },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },

  subjectPerson: {
    fullName: { type: String, default: '' },
    memberNumber: { type: String, default: '' },
    role: { type: String, default: '' },
    termStart: { type: Date, default: null },
    termEnd: { type: Date, default: null },
    membershipSince: { type: Date, default: null },
    savings: { type: Number, default: 0 },
    totalShares: { type: Number, default: 0 },
    hasActiveLoan: { type: Boolean, default: false }
  },

  // Card-specific fields (Mixed so each card type can store what it needs)
  cardDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

  signatories: { type: [String], default: ['president', 'secretary'] },

  createdBy: { type: String, default: 'admin' },
  notes: { type: String, default: '' }
}, { timestamps: true });

LetterSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Letter', LetterSchema);