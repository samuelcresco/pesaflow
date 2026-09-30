const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  shareTypes: {
    ordinary: { price: { type: Number, default: 100000 }, max: { type: Number, default: 15 } },
    silver: { price: { type: Number, default: 250000 }, max: { type: Number, default: 10 } },
    golden: { price: { type: Number, default: 500000 }, max: { type: Number, default: 5 } },
    platinum: { price: { type: Number, default: 1000000 }, max: { type: Number, default: 3 } }
  },
  loanSettings: {
    emergencyInterest: { type: Number, default: 10 },
    businessInterest: { type: Number, default: 0.1666 },
    schoolFeesInterest: { type: Number, default: 0.222 },
    loanLimitPercent: { type: Number, default: 70 }
  }
});

module.exports = mongoose.model('Settings', SettingsSchema);