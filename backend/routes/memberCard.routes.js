const express = require('express');
const router = express.Router();
const memberCardController = require('../controllers/memberCardController');

// Public verify (no auth — scanned from the card)
router.get('/member-cards/verify/:id', memberCardController.verifyMemberCard);

// Generate card PDF (protected by RBAC at /api)
router.get('/members/:id/card/pdf', memberCardController.downloadMemberCard);

module.exports = router;