const mongoose = require('mongoose');

const AgreedSavingsSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  setBy: { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.model('AgreedSavings', AgreedSavingsSchema);