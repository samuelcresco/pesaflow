const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');

// ==================== SUMMARY ====================
router.get('/summary', withdrawalController.getSummary);

// ==================== SETTINGS ====================
router.get('/settings', withdrawalController.getWithdrawalSettings);
router.put('/settings', withdrawalController.updateWithdrawalSettings);

// ==================== ELIGIBILITY ====================
router.get('/eligibility/:memberId', withdrawalController.checkMemberEligibility);

// ==================== MEMBER WITHDRAWALS ====================
router.get('/member/:memberId', withdrawalController.getMemberWithdrawals);

// ==================== LIST + CREATE ====================
router.get('/', withdrawalController.getAllWithdrawals);
router.post('/', withdrawalController.requestWithdrawal);

// ==================== SINGLE ====================
router.get('/:id', withdrawalController.getWithdrawalById);

// ==================== ACTIONS ====================
router.put('/:id/approve', withdrawalController.approveWithdrawal);
router.put('/:id/reject', withdrawalController.rejectWithdrawal);
router.put('/:id/pay', withdrawalController.recordPayment);
router.put('/:id/cancel', withdrawalController.cancelWithdrawal);

module.exports = router;