const express = require('express');
const router = express.Router();
const certController = require('../controllers/shareCertificateController');

router.get('/verify/:number', certController.verifyCertificate);
router.get('/member/:memberId', certController.getMemberCertificates);
router.get('/', certController.getAllCertificates);
router.post('/issue', certController.issueCertificate);
router.get('/:id', certController.getCertificateById);
router.get('/:id/pdf', certController.downloadCertificatePDF);
router.post('/:id/cancel', certController.cancelCertificate);
router.delete('/:id', certController.deleteCertificate);

module.exports = router;