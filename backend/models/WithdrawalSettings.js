const mongoose = require('mongoose');

const WithdrawalSettingsSchema = new mongoose.Schema({
  // June window
  juneEnabled: { type: Boolean, default: true },
  juneStartDay: { type: Number, default: 15, min: 1, max: 30 },
  juneEndDay: { type: Number, default: 30, min: 1, max: 31 },

  // December window
  decemberEnabled: { type: Boolean, default: true },
  decemberStartDay: { type: Number, default: 15, min: 1, max: 30 },
  decemberEndDay: { type: Number, default: 30, min: 1, max: 31 },

  // Caps and rules
  savingsCapPercent: { type: Number, default: 20, min: 0, max: 100 },
  blockOnActiveLoan: { type: Boolean, default: true },
  allowOverride: { type: Boolean, default: true },

  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('WithdrawalSettings', WithdrawalSettingsSchema);