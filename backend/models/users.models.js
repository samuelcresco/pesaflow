const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  memberNumber: { type: String, required: true, unique: true },
  fname: { type: String, required: true },
  lname: { type: String, required: true },
  email: { type: String, default: '' },
  phoneNumber: { type: String, required: true },
  address: { type: String, default: '' },
  occupation: { type: String, default: '' },
  dateOfBirth: { type: String, default: '' },
  idNumber: { type: String, default: '' },
  photo: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  status: { type: String, enum: ['Active', 'Suspended', 'Inactive', 'Terminated'], default: 'Active' },
  savings: { type: Array, default: [] },
  miscellaneous: { type: Array, default: [] },
  penalties: { type: Array, default: [] },
  shares: {
    ordinary: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    silver: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    golden: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } },
    platinum: { count: { type: Number, default: 0 }, amount: { type: Number, default: 0 } }
  },
  totalShares: { type: Number, default: 0 },
  totalValue: { type: Number, default: 0 },
  membershipFee: { type: Number, default: 0 },
  sharesTransactions: { type: Array, default: [] },
  membershipFeeTransactions: { type: Array, default: [] },
  assetTransactions: { type: Array, default: [] },
  donations: { type: Array, default: [] },
  businessProfits: { type: Array, default: [] },
  businessInvestments: { type: Array, default: [] },
  loans: { type: Array, default: [] },
  agreedSavings: { type: Object, default: {} },
  nextOfKinName: { type: String, default: '' },
  nextOfKinPhone: { type: String, default: '' },
  nextOfKinRelationship: { type: String, default: '' },
  dateJoined: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);