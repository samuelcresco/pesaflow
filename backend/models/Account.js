const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
    required: true
  },
  category: { type: String },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
  balance: { type: Number, default: 0 },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Account', AccountSchema);