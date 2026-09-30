const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');

// Generate password
router.get('/generate-password', memberController.generatePassword);

// Create member
router.post('/', memberController.createMember);

// Get all members
router.get('/', memberController.getAllMembers);

// Get member by ID
router.get('/:id', memberController.getMemberById);

// Update member
router.put('/:id', memberController.updateMember);

// Delete member
router.delete('/:id', memberController.deleteMember);

// Change password
router.put('/:id/change-password', memberController.changePassword);

module.exports = router;