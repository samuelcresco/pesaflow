const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const LeaderSchema = new mongoose.Schema({
  // ==================== IDENTITY ====================
  role: {
    type: String,
    enum: [
      'president',
      'vice_president',
      'secretary',
      'treasurer',
      'chairman_loan_committee',
      'chair_investment_committee',
      'loan_officer_1',
      'loan_officer_2',
      'it_technician',
      'treasurer_loan_committee'
    ],
    required: true
  },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, default: '' },
  photo: { type: String, default: '' },
  signature: { type: String, default: '' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  notes: { type: String, default: '' },

  // ==================== LOGIN CREDENTIALS ====================
  username: { type: String, unique: true, sparse: true, index: true },
  password: { type: String, select: false },       // bcrypt hashed
  plainPassword: { type: String, select: false },  // temp store for admin to view once
  mustChangePassword: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },

  // ==================== CARD ACCESS ====================
  // Admin can customize per leader. Defaults populated based on role.
  cardAccess: {
    type: [String],
    default: []
  },

  // ==================== META ====================
  createdBy: { type: String, default: '' },
  passwordChangedAt: { type: Date, default: null }
}, { timestamps: true });

// Hash password before save
LeaderSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  if (!this.password) return next();

  const pwd = String(this.password);
  if (pwd.startsWith('$2a$') || pwd.startsWith('$2b$') || pwd.startsWith('$2y$')) {
    return next(); // already hashed
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

LeaderSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Leader', LeaderSchema);