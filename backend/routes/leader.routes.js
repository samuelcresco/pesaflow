const express = require('express');
const router = express.Router();
const leaderController = require('../controllers/leaderController');

router.get('/', leaderController.getAllLeaders);
router.get('/card-defaults', leaderController.getCardDefaults);
router.post('/', leaderController.createLeader);
router.post('/login', leaderController.login);
router.post('/reorder', leaderController.reorderLeaders);
router.get('/:id', leaderController.getLeaderById);
router.put('/:id', leaderController.updateLeader);
router.post('/:id/reset-password', leaderController.resetPassword);
router.delete('/:id', leaderController.deleteLeader);
router.put('/:id/change-password', leaderController.changeOwnPassword);

module.exports = router;