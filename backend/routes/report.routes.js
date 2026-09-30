const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const dashboardController = require('../controllers/reportDashboardController');

// ==================== EXISTING ACCOUNTING REPORTS ====================
router.get('/trial-balance', reportController.getTrialBalance);
router.get('/profit-loss', reportController.getProfitAndLoss);
router.get('/balance-sheet', reportController.getBalanceSheet);
router.get('/journal-entries', reportController.getJournalEntries);

// ==================== PDFs ====================
router.get('/trial-balance/pdf', reportController.trialBalancePDF);
router.get('/profit-loss/pdf', reportController.profitLossPDF);
router.get('/balance-sheet/pdf', reportController.balanceSheetPDF);
router.get('/business/:id/transactions/pdf', reportController.businessTransactionsPDF);

// ==================== DASHBOARD AGGREGATIONS ====================
router.get('/dashboard/overview', dashboardController.getOverview);
router.get('/dashboard/savings', dashboardController.getSavingsSummary);
router.get('/dashboard/loans', dashboardController.getLoansSummary);
router.get('/dashboard/members', dashboardController.getMembersSummary);
router.get('/dashboard/shares', dashboardController.getSharesSummary);
router.get('/dashboard/business', dashboardController.getBusinessSummary);
router.get('/dashboard/expenses', dashboardController.getExpensesSummary);
router.get('/dashboard/savings/pdf', dashboardController.savingsReportPDF);
router.get('/dashboard/loans/pdf', dashboardController.loansReportPDF);
router.get('/dashboard/members/pdf', dashboardController.membersReportPDF);
router.get('/dashboard/shares/pdf', dashboardController.sharesReportPDF);
router.get('/dashboard/business/pdf', dashboardController.businessReportPDF);
router.get('/dashboard/expenses/pdf', dashboardController.expensesReportPDF);

module.exports = router;