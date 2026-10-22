const express = require('express');
const router = express.Router();
const constitutionController = require('../controllers/constitutionController');

// ---------- ADMIN ----------
router.post('/constitution/upload', constitutionController.uploadConstitution);
router.get('/constitution/info', constitutionController.getConstitutionInfo);
router.delete('/constitution', constitutionController.deleteConstitution);
router.get('/constitution/access-list', constitutionController.getAccessList);
router.put('/constitution/member/:memberId/access', constitutionController.setMemberAccess);
router.get('/constitution/download-admin', constitutionController.adminDownloadConstitution);

// ---------- MEMBER ----------
router.get('/member/constitution/status', constitutionController.getMyStatus);

module.exports = router;