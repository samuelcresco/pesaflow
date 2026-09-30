const mongoose = require('mongoose');

const LoanSchema = new mongoose.Schema({
  memberId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['emergency', 'school_fees', 'business'], 
    required: true 
  },
  amount: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, required: true }, // e.g., 5 for 5%
processingFee: { type: Number, default: 0 },
  processingFeePercent: { type: Number, default: 0 },
  netDisbursed: { type: Number, default: 0 },
  duration: { type: Number, required: true }, // 1, 2, 4, 6, 9, 12
  totalRepayable: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'disbursed', 'active', 'closed', 'rejected', 'writeOff'], 
    default: 'pending' 
  },
  appliedBy: { 
    type: String, 
    enum: ['member', 'admin'], 
    default: 'member' 
  },
  appliedDate: { type: Date, default: Date.now },
  approvedDate: Date,
  disbursedDate: Date,
  activeDate: Date,
  closedDate: Date,
  purpose: String,
  rejectionReason: String
}, { timestamps: true });

module.exports = mongoose.model('Loan', LoanSchema);