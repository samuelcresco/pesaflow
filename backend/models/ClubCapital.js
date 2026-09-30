const mongoose = require('mongoose');

const ClubCapitalSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },
  transactions: [{
    type: String,
    amount: Number,
    description: String,
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ClubCapital', ClubCapitalSchema);
