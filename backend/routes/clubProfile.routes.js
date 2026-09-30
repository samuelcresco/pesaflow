const express = require('express');
const router = express.Router();
const clubProfileController = require('../controllers/clubProfileController');

router.get('/', clubProfileController.getProfile);
router.put('/', clubProfileController.updateProfile);

module.exports = router;