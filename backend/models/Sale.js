const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true, index: true },

  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  businessName: { type: String, required: true },

  customerName: { type: String, required: true },
  customerContact: { type: String, default: '' },

  items: { type: [SaleItemSchema], default: [] },

  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },

  paymentMethod: {
    type: String,
    enum: ['cash', 'mobile_money', 'bank', 'credit', 'other'],
    default: 'cash'
  },
  paymentReference: { type: String, default: '' },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'paid'
  },
  amountPaid: { type: Number, default: 0 },
  balanceOwed: { type: Number, default: 0 },

  soldBy: { type: String, default: '' },
  notes: { type: String, default: '' },

  date: { type: Date, required: true, default: Date.now, index: true },
  month: { type: Number },
  year: { type: Number },

  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active',
    index: true
  },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  businessTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessTransaction', default: null },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null }
}, { timestamps: true });

SaleSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('Sale', SaleSchema);