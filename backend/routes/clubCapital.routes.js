const express = require('express');
const router = express.Router();
const clubCapitalController = require('../controllers/clubCapitalController');

router.get('/', clubCapitalController.getBalance);
router.get('/transactions', clubCapitalController.getTransactions);
router.post('/transaction', clubCapitalController.addTransaction);

module.exports = router;
