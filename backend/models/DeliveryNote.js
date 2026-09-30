const mongoose = require('mongoose');

const DeliveryItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'pcs' },        // pcs, kg, litres, etc.
  unitPrice: { type: Number, default: 0 },       // optional
  lineTotal: { type: Number, default: 0 }        // optional
}, { _id: false });

const DeliveryNoteSchema = new mongoose.Schema({
  noteNumber: { type: String, required: true, unique: true, index: true },

  recipientName: { type: String, required: true },
  recipientContact: { type: String, default: '' },
  recipientAddress: { type: String, default: '' },

  items: { type: [DeliveryItemSchema], default: [] },
  totalValue: { type: Number, default: 0 },

  deliveredBy: { type: String, default: '' },
  notes: { type: String, default: '' },

  date: { type: Date, required: true, default: Date.now, index: true },
  month: { type: Number },
  year: { type: Number },

  status: {
    type: String,
    enum: ['issued', 'delivered', 'cancelled'],
    default: 'issued',
    index: true
  },
  deliveredDate: { type: Date, default: null },
  cancelledReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  printedCount: { type: Number, default: 0 },
  lastPrintedAt: { type: Date, default: null },

  createdBy: { type: String, default: 'admin' }
}, { timestamps: true });

DeliveryNoteSchema.pre('save', function(next) {
  if (this.date) {
    this.month = new Date(this.date).getMonth() + 1;
    this.year = new Date(this.date).getFullYear();
  }
  next();
});

module.exports = mongoose.model('DeliveryNote', DeliveryNoteSchema);