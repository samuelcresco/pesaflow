const mongoose = require('mongoose');

const WithdrawalSettingsSchema = new mongoose.Schema({
  // First window (default: June)
  juneEnabled: { type: Boolean, default: true },
  juneMonth: { type: Number, default: 6, min: 1, max: 12 },
  juneStartDay: { type: Number, default: 15, min: 1, max: 31 },
  juneEndDay: { type: Number, default: 30, min: 1, max: 31 },

  // Second window (default: December)
  decemberEnabled: { type: Boolean, default: true },
  decemberMonth: { type: Number, default: 12, min: 1, max: 12 },
  decemberStartDay: { type: Number, default: 15, min: 1, max: 31 },
  decemberEndDay: { type: Number, default: 30, min: 1, max: 31 },

  // ==================== DIVIDEND-SPECIFIC WINDOW ====================
  dividendWindowEnabled: { type: Boolean, default: true },
  dividendStartMonth: { type: Number, default: 12, min: 1, max: 12 },
  dividendStartDay: { type: Number, default: 1, min: 1, max: 31 },
  dividendEndMonth: { type: Number, default: 12, min: 1, max: 12 },
  dividendEndDay: { type: Number, default: 31, min: 1, max: 31 },

  // Caps and rules
  savingsCapPercent: { type: Number, default: 20, min: 0, max: 100 },
  blockOnActiveLoan: { type: Boolean, default: true },
  allowOverride: { type: Boolean, default: true },

  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('WithdrawalSettings', WithdrawalSettingsSchema);