const mongoose = require('mongoose');

const RepaymentSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  installmentNumber: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  amountDue: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Repayment', RepaymentSchema);