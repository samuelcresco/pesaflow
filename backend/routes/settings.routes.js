const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');

// Loan settings
router.get('/', settingController.getSettings);
router.put('/', settingController.updateSettings);

// Share settings
router.get('/shares', settingController.getShareSettings);
router.put('/shares', settingController.updateShareSettings);

// Public eligibility text (used by loan form)
router.get('/loan-eligibility', settingController.getLoanEligibilityText);

module.exports = router;