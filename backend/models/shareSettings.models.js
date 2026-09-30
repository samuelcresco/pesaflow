const mongoose = require('mongoose');

const ShareSettingsSchema = new mongoose.Schema({
  shareTypes: {
    type: Object,
    default: {
      ordinary: { name: 'Ordinary', price: 100000, maxShares: 15, active: true },
      silver:   { name: 'Silver',   price: 250000, maxShares: 10, active: true },
      golden:   { name: 'Golden',   price: 500000, maxShares: 5,  active: true },
      platinum: { name: 'Platinum', price: 1000000, maxShares: 3, active: true }
    }
  },
  dividendPercentages: {
    type: Object,
    default: {
      ordinary: 10,
      silver: 20,
      golden: 30,
      platinum: 40
    }
  },
  loanEligibility: {
    type: Object,
    default: {
      emergency: 'Must have 4 Golden shares OR above',
      school_fees: 'Must have at least 1 Platinum share',
      business: 'Must have at least 1 Platinum AND 1 Silver share'
    }
  },
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShareSettings', ShareSettingsSchema);