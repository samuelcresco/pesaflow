const express = require('express');
const router = express.Router();
const controller = require('../controllers/deliveryNoteController');

router.get('/verify/:number', controller.verifyDeliveryNote);
router.get('/', controller.getAllDeliveryNotes);
router.post('/', controller.createDeliveryNote);
router.get('/:id', controller.getDeliveryNoteById);
router.get('/:id/pdf', controller.downloadDeliveryNotePDF);
router.put('/:id/mark-delivered', controller.markDelivered);
router.post('/:id/cancel', controller.cancelDeliveryNote);
router.delete('/:id', controller.deleteDeliveryNote);

module.exports = router;