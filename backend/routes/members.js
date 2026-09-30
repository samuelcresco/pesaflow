const express = require('express');
const router = express.Router();
const User = require('../models/users.models');
const { adminOnly, restrictToOwner } = require('../middleware/auth');

// Get all users
router.get('/', adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { fname: { $regex: search, $options: 'i' } },
        { lname: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status !== undefined) {
      query.isActive = status === 'true';
    }
    
    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .select('-__v');
      
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalUsers: total
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch users', 
      details: error.message 
    });
  }
});

// Get user by member number
router.get('/:id', restrictToOwner, async (req, res) => {
  try {
    const user = await User.findOne({ memberNumber: req.params.id.toUpperCase() })
      .select('-__v');
      
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch user', 
      details: error.message 
    });
  }
});

// Create new user
router.post('/',adminOnly, async (req, res) => {
  try {
    const { memberNumber, fname, lname, email, phoneNumber, dateJoined, emergencyContacts } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { memberNumber: memberNumber?.toUpperCase() },
        { email: email?.toLowerCase() }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists', 
        details: 'Member number or email already in use' 
      });
    }

    const newUser = new User({
      memberNumber,
      fname,
      lname,
      email,
      phoneNumber,
      dateJoined,
      emergencyContacts
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to create user', 
      details: error.message 
    });
  }
});

// Update user by member number
router.put('/:id',restrictToOwner, async (req, res) => {
  try {
    const { fname, lname, email, phoneNumber, dateJoined, emergencyContacts, isActive } = req.body;
    
    const updatedUser = await User.findOneAndUpdate(
      { memberNumber: req.params.id.toUpperCase() },
      {
        fname,
        lname,
        email,
        phoneNumber,
        dateJoined,
        emergencyContacts,
        isActive
      },
      { 
        new: true, 
        runValidators: true,
        omitUndefined: true // Only update provided fields
      }
    ).select('-__v');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    res.status(500).json({ 
      error: 'Failed to update user', 
      details: error.message 
    });
  }
});

// Delete user by member number (soft delete)
router.delete('/:id',adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { memberNumber: req.params.id.toUpperCase() },
      { isActive: false },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User deactivated successfully', 
      user 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete user', 
      details: error.message 
    });
  }
});

// Permanently delete user
router.delete('/:id/permanent',adminOnly, async (req, res) => {
  try {
    const deletedUser = await User.findOneAndDelete({ 
      memberNumber: req.params.id.toUpperCase() 
    });

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User permanently deleted', 
      user: deletedUser 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to permanently delete user', 
      details: error.message 
    });
  }
});

// Restore deactivated user
router.patch('/:id/restore',adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { memberNumber: req.params.id.toUpperCase() },
      { isActive: true },
      { new: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User restored successfully', 
      user 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to restore user', 
      details: error.message 
    });
  }
});

module.exports = router;
