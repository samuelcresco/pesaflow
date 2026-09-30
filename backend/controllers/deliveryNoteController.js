const DeliveryNote = require('../models/DeliveryNote');
const { generateDeliveryNoteNumber } = require('../utils/deliveryNoteNumber');
const { generateDeliveryNotePDF } = require('../utils/deliveryNotePDF');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== CREATE ====================
exports.createDeliveryNote = async (req, res) => {
  try {
    const {
      recipientName,
      recipientContact,
      recipientAddress,
      items,
      deliveredBy,
      notes,
      date,
      createdBy
    } = req.body;

    if (!recipientName || !recipientName.trim()) return res.status(400).json({ error: 'Recipient name is required' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

    const preparedItems = [];
    let totalValue = 0;

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      if (!item.description || !item.description.trim()) continue;

      const unitPrice = Number(item.unitPrice) || 0;
      const lineTotal = qty * unitPrice;

      preparedItems.push({
        description: item.description.trim(),
        quantity: qty,
        unit: item.unit || 'pcs',
        unitPrice,
        lineTotal
      });
      totalValue += lineTotal;
    }

    if (preparedItems.length === 0) return res.status(400).json({ error: 'No valid items with quantity provided' });

    let noteNumber;
    try {
      noteNumber = await generateDeliveryNoteNumber(date ? new Date(date) : new Date());
    } catch (e) {
      noteNumber = await generateDeliveryNoteNumber(date ? new Date(date) : new Date());
    }

    const note = await DeliveryNote.create({
      noteNumber,
      recipientName: recipientName.trim(),
      recipientContact: recipientContact || '',
      recipientAddress: recipientAddress || '',
      items: preparedItems,
      totalValue,
      deliveredBy: deliveredBy || '',
      notes: notes || '',
      date: date ? new Date(date) : new Date(),
      createdBy: createdBy || 'admin'
    });

    res.status(201).json({ success: true, deliveryNote: note });
  } catch (error) {
    console.error('CREATE DELIVERY NOTE ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL ====================
exports.getAllDeliveryNotes = async (req, res) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    else filter.status = { $ne: 'cancelled' };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { noteNumber: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { recipientContact: { $regex: search, $options: 'i' } }
      ];
    }

    const notes = await DeliveryNote.find(filter).sort('-date').limit(500);
    res.json({ deliveryNotes: notes, total: notes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getDeliveryNoteById = async (req, res) => {
  try {
    const note = await DeliveryNote.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Delivery note not found' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY (public for QR) ====================
exports.verifyDeliveryNote = async (req, res) => {
  try {
    const note = await DeliveryNote.findOne({ noteNumber: req.params.number });
    if (!note) {
      return res.status(404).json({ valid: false, error: 'Delivery note not found' });
    }
    res.json({
      valid: note.status !== 'cancelled',
      status: note.status,
      noteNumber: note.noteNumber,
      recipientName: note.recipientName,
      recipientContact: note.recipientContact,
      items: note.items,
      totalValue: note.totalValue,
      date: note.date,
      deliveredBy: note.deliveredBy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DOWNLOAD PDF ====================
exports.downloadDeliveryNotePDF = async (req, res) => {
  try {
    const note = await DeliveryNote.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Delivery note not found' });

    note.printedCount = (note.printedCount || 0) + 1;
    note.lastPrintedAt = new Date();
    await note.save();

    await generateDeliveryNotePDF(note, res);
  } catch (error) {
    console.error('DELIVERY NOTE PDF ERROR:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== MARK DELIVERED ====================
exports.markDelivered = async (req, res) => {
  try {
    const note = await DeliveryNote.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Delivery note not found' });
    if (note.status === 'cancelled') return res.status(400).json({ error: 'Cannot mark a cancelled note as delivered' });

    note.status = 'delivered';
    note.deliveredDate = new Date();
    await note.save();

    res.json({ success: true, message: 'Marked as delivered', deliveryNote: note });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== CANCEL ====================
exports.cancelDeliveryNote = async (req, res) => {
  try {
    const { reason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Cancellation reason is required' });

    const note = await DeliveryNote.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Delivery note not found' });
    if (note.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    note.status = 'cancelled';
    note.cancelledReason = reason;
    note.cancelledAt = new Date();
    note.cancelledBy = cancelledBy || 'admin';
    await note.save();

    res.json({ success: true, message: 'Delivery note cancelled', deliveryNote: note });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE ====================
exports.deleteDeliveryNote = async (req, res) => {
  try {
    const note = await DeliveryNote.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ error: 'Delivery note not found' });
    res.json({ success: true, message: 'Delivery note permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};