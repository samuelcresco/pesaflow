const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/savingRequestController');

// Member
router.post('/member/:id/apply', ctrl.submitDepositRequest);
router.get('/member/:id', ctrl.getMyDepositRequests);

// Admin
router.get('/', ctrl.getAllSavingRequests);
router.put('/:id/approve', ctrl.approveSavingRequest);
router.put('/:id/reject', ctrl.rejectSavingRequest);

module.exports = router;