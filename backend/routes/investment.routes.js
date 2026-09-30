const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');

router.post('/buy', investmentController.buyAsset);
router.post('/sell/:id', investmentController.sellAsset);
router.get('/', investmentController.getAllInvestments);
router.get('/:id', investmentController.getInvestmentById);

module.exports = router;