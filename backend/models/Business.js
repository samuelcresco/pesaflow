const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['investment', 'operating', 'loan'],
    default: 'operating'
  },
  startDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  isSystem: { type: Boolean, default: false },
  fundAccountCode: { type: String },
  createdBy: { type: String },
  totalCapitalAllocated: { type: Number, default: 0 },
  totalProfitExtracted: { type: Number, default: 0 },
  totalProfitDeclared: { type: Number, default: 0 },   // NEW: cumulative declared to pool
  currentBalance: { type: Number, default: 0 },

  // ==================== BRANDING ====================
  tagline: { type: String, default: '' },              // e.g., "Quality Supplies"
  contact: { type: String, default: '' },              // phone
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  logo: { type: String, default: '' },                 // base64 or file path

  // ==================== PROFIT RETENTION ====================
  minimumRetention: { type: Number, default: 0 },      // floor of working capital that cannot be declared
}, { timestamps: true });

module.exports = mongoose.model('Business', BusinessSchema);