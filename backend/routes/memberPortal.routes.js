const express = require('express');
const router = express.Router();
const memberPortalController = require('../controllers/memberPortalController');
const memberController = require('../controllers/memberController');
const loanController = require('../controllers/loanController');
const constitutionController = require('../controllers/constitutionController');
const dividendController = require('../controllers/dividendController');
const savingRequestController = require('../controllers/savingRequestController');
const withdrawalController = require('../controllers/withdrawalController');

router.post('/login', memberPortalController.login);
router.post('/forgot-password', memberPortalController.forgotPassword);
router.put('/me/:id/change-password', memberPortalController.changePassword);
router.get('/me/:id', memberPortalController.getMyProfile);
router.get('/me/:id/savings', memberPortalController.getMySavings);
router.get('/me/:id/shares', memberPortalController.getMyShares);
router.get('/me/:id/loans', memberPortalController.getMyLoans);
router.get('/me/:id/dividends', memberPortalController.getMyDividends);
router.get('/me/:id/statement', memberController.getMemberStatement);
router.get('/me/:id/statement/pdf', memberController.downloadMemberStatementPDF);
router.get('/me/:id/schedule', loanController.getScheduleJSON);
router.post('/me/:id/apply-loan', memberPortalController.applyForLoan);

// ==================== DIVIDENDS ====================
router.get('/me/:id/dividend-summary', dividendController.getMyDividendSummary);
router.get('/me/:id/dividend-history', dividendController.getMyDividendHistory);
router.post('/me/:id/use-dividends', dividendController.useDividends);

// ==================== SAVINGS DEPOSIT REQUESTS ====================
router.post('/me/:id/saving-request', savingRequestController.submitDepositRequest);
router.get('/me/:id/saving-requests', savingRequestController.getMyDepositRequests);

// ==================== SAVINGS WITHDRAWALS ====================
router.post('/me/:id/withdraw-request', withdrawalController.memberRequestWithdrawal);
router.get('/me/:id/withdrawals/pdf', withdrawalController.memberWithdrawalStatementPDF);

router.get('/constitution/status', constitutionController.getMyStatus);
router.get('/constitution/download', constitutionController.downloadConstitution);

router.get('/club-stats', memberPortalController.getClubStats);
router.get('/leaders', memberPortalController.getLeaders);

module.exports = router;