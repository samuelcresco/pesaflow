const mongoose = require('mongoose');

const ClubProfileSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'CRESTED SS INVESTMENT CLUB LTD' },
  tagline: { type: String, default: 'SACCO Management Platform' },
  location: { type: String, default: 'Kampala, Uganda' },
  address: { type: String, default: '' },
  postalAddress: { type: String, default: '' },
  contact: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  registrationNumber: { type: String, default: '' },
  tin: { type: String, default: '' },
  logo: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ClubProfile', ClubProfileSchema);