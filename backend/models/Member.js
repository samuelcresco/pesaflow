const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MemberSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  surname: { type: String, required: true },
  occupation: { type: String },
  contact: { type: String, required: true },
  email: { type: String, default: '' },
  address: { type: String, required: true },
  photo: { type: String, default: '' },
  memberNumber: { type: String, required: true, unique: true },
  dateOfBirth: { type: Date, required: true },
  dateOfSubscription: { type: Date, default: Date.now },
  password: { type: String, required: true },

  shares: {
    golden: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    bronze: { type: Number, default: 0 }
  },

  // Savings (contributions) — 20% cap applies to withdrawals
  savings: { type: Number, default: 0 },
  lockedSavings: { type: Number, default: 0 },
  activeLoanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null },

  // Dividends received — no cap on withdrawal
  dividendBalance: { type: Number, default: 0 },
  totalDividendsReceived: { type: Number, default: 0 },
  totalDividendsWithdrawn: { type: Number, default: 0 },

  nextOfKin: {
    fullName: { type: String, required: true },
    relationship: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    photo: { type: String, default: '' }
  },

  active: { type: Boolean, default: true }
}, { timestamps: true });

MemberSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // Skip if already a bcrypt hash — prevents double-hashing
  const pwd = String(this.password || '');
  if (pwd.startsWith('$2a$') || pwd.startsWith('$2b$') || pwd.startsWith('$2y$')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

MemberSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

MemberSchema.virtual('totalShares').get(function() {
  return this.shares.golden + this.shares.platinum + this.shares.silver + this.shares.bronze;
});

MemberSchema.virtual('availableSavings').get(function() {
  return this.savings - this.lockedSavings;
});

MemberSchema.pre('save', function(next) {
  const total = this.shares.golden + this.shares.platinum + this.shares.silver + this.shares.bronze;
  if (total > 15) throw new Error('Total shares cannot exceed 15');
  next();
});

module.exports = mongoose.model('Member', MemberSchema);