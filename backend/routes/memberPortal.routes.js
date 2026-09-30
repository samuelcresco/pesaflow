const express = require('express');
const router = express.Router();
const memberPortalController = require('../controllers/memberPortalController');

// Auth
router.post('/login', memberPortalController.login);
router.post('/forgot-password', memberPortalController.forgotPassword);
router.put('/me/:id/change-password', memberPortalController.changePassword);

// Profile
router.get('/me/:id', memberPortalController.getMyProfile);

// Data
router.get('/me/:id/savings', memberPortalController.getMySavings);
router.get('/me/:id/shares', memberPortalController.getMyShares);
router.get('/me/:id/loans', memberPortalController.getMyLoans);
router.get('/me/:id/dividends', memberPortalController.getMyDividends);

// Actions
router.post('/me/:id/apply-loan', memberPortalController.applyForLoan);

// Public info
router.get('/club-stats', memberPortalController.getClubStats);
router.get('/leaders', memberPortalController.getLeaders);

module.exports = router;