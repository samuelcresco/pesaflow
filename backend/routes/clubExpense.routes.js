const express = require('express');
const router = express.Router();
const clubExpenseController = require('../controllers/clubExpenseController');

router.post('/', clubExpenseController.createExpense);
router.get('/', clubExpenseController.getAllExpenses);

module.exports = router;