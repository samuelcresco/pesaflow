const mongoose = require('mongoose');

const ClubSettingSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  agreedMonthlyAmount: { type: Number, default: 0 },
  membershipFee: { type: Number, default: 0 },
  membershipRenewalFee: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ClubSetting', ClubSettingSchema);