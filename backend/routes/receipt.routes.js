const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');

// ==================== PUBLIC ====================
// Verify receipt authenticity by receipt number (used by QR codes)
router.get('/verify/:number', receiptController.verifyReceipt);

// ==================== LIST / QUERY ====================
router.get('/', receiptController.getAllReceipts);
router.get('/daily-batch', receiptController.getDailyBatch);
router.get('/member/:memberId', receiptController.getMemberReceipts);

// ==================== CREATE ====================
router.post('/', receiptController.createReceipt);
router.post('/multi-item', receiptController.createMultiItemReceipt);

// ==================== SINGLE RECEIPT ====================
router.get('/:id', receiptController.getReceiptById);
router.get('/:id/pdf', receiptController.downloadReceiptPDF);

// ==================== ACTIONS ====================
router.post('/:id/cancel', receiptController.cancelReceipt);
router.delete('/:id', receiptController.deleteReceipt);

module.exports = router;