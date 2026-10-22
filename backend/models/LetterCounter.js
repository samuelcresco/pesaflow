const mongoose = require('mongoose');

const LetterCounterSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['appointment', 'recommendation', 'good_standing', 'general'],
    required: true
  },
  year: { type: Number, required: true },
  count: { type: Number, default: 0 }
}, { timestamps: true });

LetterCounterSchema.index({ type: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LetterCounter', LetterCounterSchema);