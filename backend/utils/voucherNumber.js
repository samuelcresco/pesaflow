const PaymentVoucher = require('../models/PaymentVoucher');

// Generate sequential voucher numbers: PV-YYYY-NNNNNN
// Example: PV-2026-000001, PV-2026-000002, ...
async function generateVoucherNumber(date = new Date()) {
  const year = new Date(date).getFullYear();
  const prefix = `PV-${year}-`;

  const last = await PaymentVoucher.findOne({
    voucherNumber: { $regex: `^${prefix}` }
  }).sort({ voucherNumber: -1 }).lean();

  let nextSeq = 1;
  if (last?.voucherNumber) {
    const parts = last.voucherNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

module.exports = { generateVoucherNumber };