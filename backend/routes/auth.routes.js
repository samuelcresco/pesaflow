const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/users.models');

router.post('/login', async (req, res) => {
  try {
    const { memberNumber, password } = req.body;

    if (!memberNumber || !password) {
      return res.status(400).json({ error: 'Member number and password are required' });
    }

    const user = await User.findOne({ memberNumber: memberNumber }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        memberNumber: user.memberNumber,
        role: user.role || 'member',
        fname: user.fname || '',
        lname: user.lname || '',
        email: user.email || ''
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;