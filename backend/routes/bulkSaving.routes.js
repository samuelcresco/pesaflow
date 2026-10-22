const express = require('express');
const router = express.Router();
const bulkController = require('../controllers/bulkSavingController');

router.post('/preview', bulkController.previewBulk);
router.post('/commit', bulkController.commitBulk);
router.get('/batches', bulkController.listBatches);
router.post('/batches/:id/reverse', bulkController.reverseBatch);

module.exports = router;