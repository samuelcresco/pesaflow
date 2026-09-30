const mongoose = require('mongoose');

const DividendSchema = new mongoose.Schema({
  totalAmount: { type: Number, required: true },
  distributionDate: { type: Date, required: true },
  month: { type: Number },
  year: { type: Number },
  shareTypePercentages: {
    platinum: { type: Number, default: 40 },
    golden: { type: Number, default: 30 },
    silver: { type: Number, default: 20 },
    bronze: { type: Number, default: 10 }
  },
  distributions: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    memberName: String,
    memberNumber: String,
    platinumShares: { type: Number, default: 0 },
    goldenShares: { type: Number, default: 0 },
    silverShares: { type: Number, default: 0 },
    bronzeShares: { type: Number, default: 0 },
    amountFromPlatinum: { type: Number, default: 0 },
    amountFromGolden: { type: Number, default: 0 },
    amountFromSilver: { type: Number, default: 0 },
    amountFromBronze: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }
  }],
  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Dividend', DividendSchema);