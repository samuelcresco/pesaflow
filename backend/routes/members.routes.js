const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');

router.post('/', memberController.createMember);
router.get('/', memberController.getAllMembers);

// MUST be before /:id so Express doesn't treat "number" as an ID
router.get('/number/:memberNumber', memberController.getMemberByNumber);

router.get('/:id', memberController.getMemberById);
router.put('/:id', memberController.updateMember);
router.delete('/:id', memberController.deleteMember);
router.put('/:id/change-password', memberController.changePassword);
router.put('/:id/reset-password', memberController.resetMemberPassword);
router.get('/:id/statement', memberController.getMemberStatement);
router.get('/:id/statement/pdf', memberController.downloadMemberStatementPDF);

module.exports = router;