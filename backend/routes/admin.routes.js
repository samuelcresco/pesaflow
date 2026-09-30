const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CHANGE PASSWORD ====================
router.put('/:id/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

    admin.password = newPassword;
    await admin.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== RESET PASSWORD (Forgot Password) ====================
router.post('/reset-password', async (req, res) => {
  try {
    const { username, recoveryKey, newPassword } = req.body;

    // Recovery key — change this to whatever secret you want
    const RECOVERY_KEY = process.env.RECOVERY_KEY || 'CRESTED-RESET-2026';

    if (recoveryKey !== RECOVERY_KEY) {
      return res.status(400).json({ error: 'Invalid recovery key' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    admin.password = newPassword;
    await admin.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== SETUP (one-time admin creation) ====================
router.post('/setup', async (req, res) => {
  try {
    const existing = await Admin.findOne({ username: 'admin' });
    if (existing) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const admin = new Admin({
      username: 'admin',
      email: 'admin@pesaflow.com',
      password: 'password',
      role: 'operator'
    });

    await admin.save();
    res.json({ success: true, message: 'Admin created. Username: admin, Password: password' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;