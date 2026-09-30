const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// ==================== UNIFIED LEDGER ====================
router.get('/', transactionController.getAllTransactions);

// ==================== REVERSE ====================
router.post('/reverse', transactionController.reverseTransaction);

// ==================== SINGLE TRANSACTION DETAIL ====================
router.get('/:sourceModel/:sourceId', transactionController.getTransactionDetail);

module.exports = router;