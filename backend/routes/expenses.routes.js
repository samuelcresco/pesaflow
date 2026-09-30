const express = require('express');
const router = express.Router();
const clubExpenseController = require('../controllers/clubExpenseController');
const expenseVoucherController = require('../controllers/expenseVoucherController');

// ==================== CLUB EXPENSES ====================
router.post('/', clubExpenseController.createExpense);
router.get('/', clubExpenseController.getAllExpenses);
router.get('/category-totals', clubExpenseController.getCategoryTotals);
router.get('/club/:id', clubExpenseController.getExpenseById);
router.delete('/club/:id', clubExpenseController.deleteExpense);

// ==================== VOUCHERS ====================
router.get('/vouchers', expenseVoucherController.getAllVouchers);
router.get('/vouchers/verify/:number', expenseVoucherController.verifyVoucher);
router.get('/vouchers/:id', expenseVoucherController.getVoucherById);
router.get('/vouchers/:id/pdf', expenseVoucherController.downloadVoucherPDF);
router.post('/vouchers/:id/cancel', expenseVoucherController.cancelVoucher);
router.post('/vouchers/:id/delete', expenseVoucherController.deleteVoucher);
router.post('/vouchers/:id/restore', expenseVoucherController.restoreVoucher);

module.exports = router;