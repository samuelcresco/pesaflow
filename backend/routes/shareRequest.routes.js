const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/shareRequestController');

// Member side
router.post('/member/:id/apply', ctrl.applyForShares);
router.get('/member/:id', ctrl.getMyShareRequests);

// Admin side
router.get('/', ctrl.getAllShareRequests);
router.put('/:id/approve', ctrl.approveShareRequest);
router.put('/:id/reject', ctrl.rejectShareRequest);

module.exports = router;