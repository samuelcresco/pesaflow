const Sale = require('../models/Sale');

async function generateSaleReceiptNumber(date = new Date()) {
  const year = new Date(date).getFullYear();
  const prefix = `SR-${year}-`;

  const last = await Sale.findOne({
    receiptNumber: { $regex: `^${prefix}` }
  }).sort({ receiptNumber: -1 }).lean();

  let nextSeq = 1;
  if (last?.receiptNumber) {
    const parts = last.receiptNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

module.exports = { generateSaleReceiptNumber };