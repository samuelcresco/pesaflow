const Receipt = require('../models/Receipt');

// Generates sequential receipt numbers: RCP-YYYY-NNNNNN
// Example: RCP-2026-000001, RCP-2026-000002, ...
async function generateReceiptNumber(date = new Date()) {
  const year = new Date(date).getFullYear();

  // Find the highest receipt number for this year
  const prefix = `RCP-${year}-`;
  const last = await Receipt.findOne({
    receiptNumber: { $regex: `^${prefix}` }
  }).sort({ receiptNumber: -1 }).lean();

  let nextSeq = 1;
  if (last && last.receiptNumber) {
    const parts = last.receiptNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  const padded = String(nextSeq).padStart(6, '0');
  return `${prefix}${padded}`;
}

module.exports = { generateReceiptNumber };