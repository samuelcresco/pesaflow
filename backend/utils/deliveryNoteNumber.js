const DeliveryNote = require('../models/DeliveryNote');

async function generateDeliveryNoteNumber(date = new Date()) {
  const year = new Date(date).getFullYear();
  const prefix = `DN-${year}-`;

  const last = await DeliveryNote.findOne({
    noteNumber: { $regex: `^${prefix}` }
  }).sort({ noteNumber: -1 }).lean();

  let nextSeq = 1;
  if (last?.noteNumber) {
    const parts = last.noteNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

module.exports = { generateDeliveryNoteNumber };