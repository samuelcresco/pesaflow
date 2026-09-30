const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  // Loan Settings
  loanLimitPercent: { type: Number, default: 70 },
  emergencyInterest: { type: Number, default: 5 },
  schoolFeesInterest: { type: Number, default: 8 },
  businessInterest: { type: Number, default: 10 },
 processingFeeEmergency: { type: Number, default: 0 },
  processingFeeSchoolFees: { type: Number, default: 0 },
  processingFeeBusiness: { type: Number, default: 0 },
  latePenaltyEmergency: { type: Number, default: 0 },
  latePenaltySchoolFees: { type: Number, default: 0 },
  latePenaltyBusiness: { type: Number, default: 0 },

  // Duration Defaults
  emergencyDurationMonths: { type: Number, default: 1 },
  schoolFeesDefaultMonths: { type: Number, default: 3 },
  businessDefaultMonths: { type: Number, default: 6 },

  // Dividend Percentages
  dividendPlatinumPercent: { type: Number, default: 40 },
  dividendGoldenPercent: { type: Number, default: 30 },
  dividendSilverPercent: { type: Number, default: 20 },
  dividendBronzePercent: { type: Number, default: 10 },

  // Savings Settings
  monthlySavingsAmount: { type: Number, default: 0 },
  membershipFeeAmount: { type: Number, default: 0 },
  annualRenewalFee: { type: Number, default: 0 }  // NEW
}, { timestamps: true });

module.exports = mongoose.model('Setting', SettingSchema);