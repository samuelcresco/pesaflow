const mongoose = require('mongoose');

const ConstitutionSchema = new mongoose.Schema({
  title: { type: String, default: 'Club Constitution' },
  version: { type: String, default: '1.0' },
  pdfData: { type: String, required: true }, // base64 data URL
  fileName: { type: String, default: 'constitution.pdf' },
  fileSize: { type: Number, default: 0 },
  uploadedBy: { type: String, default: 'admin' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Constitution', ConstitutionSchema);