const express = require('express');
const router = express.Router();
const dividendController = require('../controllers/dividendController');

router.post('/distribute', dividendController.distributeDividends);
router.post('/preview', dividendController.previewDividend);
router.get('/', dividendController.getAllDividends);
router.get('/:id', dividendController.getDividendById);

module.exports = router;