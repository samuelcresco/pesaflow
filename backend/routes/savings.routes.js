const express = require('express');
const router = express.Router();
const savingController = require('../controllers/savingController');

// Savings
router.post('/add', savingController.addSaving);
router.get('/', savingController.getAllSavings);
router.get('/summary', savingController.getSummary);
router.get('/members', savingController.getMemberSavingsList);
router.delete('/:id', savingController.deleteSaving);
router.delete('/settings/:year', savingController.deleteClubSetting);

// Settings
router.get('/agreed-savings', savingController.getAgreedSavings);
router.get('/membership-fees', savingController.getMembershipFees);
router.post('/settings/agreed-monthly', savingController.setAgreedMonthly);
router.post('/settings/membership-fees', savingController.setMembershipFees);
router.post('/settings/membership-fee', savingController.setMembershipFee);
router.get('/settings', savingController.getSettings);

// PDFs
router.get('/member-statement/:memberId', savingController.downloadMemberStatement);
router.get('/club-capital-report', savingController.downloadClubCapitalReport);
router.get('/general-report', savingController.downloadGeneralReport);

// External donations
router.get('/external-donations', savingController.getExternalDonations);
router.get('/external-donations/pdf', savingController.externalDonationsPDF);

module.exports = router;