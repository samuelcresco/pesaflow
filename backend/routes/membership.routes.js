const express = require('express');
const router = express.Router();
const certCtrl = require('../controllers/membershipCertificateController');
const renewCtrl = require('../controllers/membershipRenewalController');

// ==================== PUBLIC VERIFY ====================
router.get('/certificates/verify/:number', certCtrl.verifyCertificate);

// ==================== CERTIFICATES ====================
router.get('/certificates', certCtrl.getAllCertificates);
router.get('/certificates/member/:memberId', certCtrl.getMemberCertificates);
router.post('/certificates/issue', certCtrl.issueManual);
router.post('/certificates/issue-missing', certCtrl.issueMissingCertificates);
router.get('/certificates/:id/pdf', certCtrl.downloadCertificatePDF);
router.post('/certificates/:id/cancel', certCtrl.cancelCertificate);
router.delete('/certificates/:id', certCtrl.deleteCertificate);

// ==================== RENEWAL ====================
router.get('/renewal/stats', renewCtrl.getStats);
router.get('/renewal/preview', renewCtrl.previewRenewal);
router.post('/renewal/execute', renewCtrl.executeRenewal);

// ==================== MEMBER STATUS ====================
router.get('/members-status', renewCtrl.getMembersStatus);
router.post('/mark-paid', renewCtrl.markAsPaid);

// ==================== DEBT / ARREARS ====================
router.get('/debt', renewCtrl.getDebtList);
router.post('/waive', renewCtrl.waiveYear);
router.post('/unwaive', renewCtrl.unwaiveYear);

module.exports = router;