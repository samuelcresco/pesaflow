const mongoose = require('mongoose');

const LoanSettingsSchema = new mongoose.Schema({
  loanLimitPercentage: { type: Number, default: 70 },
  interestRates: {
    emergency: { type: Number, default: 5 },
    school_fees: { type: Number, default: 8 },
    business: { type: Number, default: 10 }
  },
  eligibilityRules: {
    emergency: { type: String, default: 'Active member with 4 Golden shares' },
    school_fees: { type: String, default: 'Active member with 1 Platinum share' },
    business: { type: String, default: 'Active member with 1 Platinum and 1 Silver share' }
  },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LoanSettings', LoanSettingsSchema);