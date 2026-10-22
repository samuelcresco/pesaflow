const express = require('express');
const router = express.Router();
const letterController = require('../controllers/letterController');

router.get('/options', letterController.getLetterOptions);
router.get('/', letterController.listLetters);
router.post('/', letterController.createLetter);
router.get('/:id', letterController.getLetter);
router.get('/:id/pdf', letterController.letterPDF);
router.delete('/:id', letterController.deleteLetter);

module.exports = router;