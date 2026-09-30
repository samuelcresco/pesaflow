const PaymentVoucher = require('../models/PaymentVoucher');
const ClubExpense = require('../models/ClubExpense');
const BusinessTransaction = require('../models/BusinessTransaction');
const { generatePaymentVoucherPDF } = require('../utils/paymentVoucherPDF');

// ==================== GET ALL VOUCHERS ====================
exports.getAllVouchers = async (req, res) => {
  try {
    const { voucherFor, businessId, status, startDate, endDate, search } = req.query;
    const filter = {};
    if (voucherFor) filter.voucherFor = voucherFor;
    if (businessId) filter.businessId = businessId;

    // Default: hide deleted vouchers unless explicitly filtered
    if (status) filter.status = status;
    else filter.status = { $ne: 'deleted' };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { voucherNumber: { $regex: search, $options: 'i' } },
        { payee: { $regex: search, $options: 'i' } },
        { cashier: { $regex: search, $options: 'i' } }
      ];
    }

    const vouchers = await PaymentVoucher.find(filter).sort('-date').limit(500);
    const totalAmount = vouchers
      .filter(v => v.status === 'issued')
      .reduce((s, v) => s + Number(v.totalAmount || 0), 0);

    res.json({ vouchers, total: vouchers.length, totalAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getVoucherById = async (req, res) => {
  try {
    const voucher = await PaymentVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json(voucher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY (public for QR) ====================
exports.verifyVoucher = async (req, res) => {
  try {
    const voucher = await PaymentVoucher.findOne({ voucherNumber: req.params.number });
    if (!voucher) {
      return res.status(404).json({ valid: false, error: 'Voucher not found' });
    }
    res.json({
      valid: voucher.status === 'issued',
      status: voucher.status,
      voucherNumber: voucher.voucherNumber,
      voucherFor: voucher.voucherFor,
      payee: voucher.payee,
      cashier: voucher.cashier,
      totalAmount: voucher.totalAmount,
      date: voucher.date,
      lineItems: voucher.lineItems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DOWNLOAD PDF ====================
exports.downloadVoucherPDF = async (req, res) => {
  try {
    const voucher = await PaymentVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

    voucher.printedCount = (voucher.printedCount || 0) + 1;
    voucher.lastPrintedAt = new Date();
    await voucher.save();

    await generatePaymentVoucherPDF(voucher, res);
  } catch (error) {
    console.error('VOUCHER PDF ERROR:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== CANCEL VOUCHER ====================
// Soft action: marks status = cancelled. Record stays. Reversible conceptually.
exports.cancelVoucher = async (req, res) => {
  try {
    const { reason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Cancellation reason is required' });

    const voucher = await PaymentVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status === 'cancelled') return res.status(400).json({ error: 'Voucher already cancelled' });
    if (voucher.status === 'deleted') return res.status(400).json({ error: 'Cannot cancel a deleted voucher' });

    voucher.status = 'cancelled';
    voucher.cancelledReason = reason;
    voucher.cancelledAt = new Date();
    voucher.cancelledBy = cancelledBy || 'admin';
    await voucher.save();

    res.json({ success: true, message: 'Voucher cancelled', voucher });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE VOUCHER (soft delete) ====================
// Marks status = deleted. Record stays for audit. Hidden from main list.
exports.deleteVoucher = async (req, res) => {
  try {
    const { reason, deletedBy } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Deletion reason is required' });
    }

    const voucher = await PaymentVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status === 'deleted') return res.status(400).json({ error: 'Voucher already deleted' });

    voucher.status = 'deleted';
    voucher.deletedReason = reason;
    voucher.deletedAt = new Date();
    voucher.deletedBy = deletedBy || 'admin';
    await voucher.save();

    res.json({
      success: true,
      message: `Voucher ${voucher.voucherNumber} deleted (soft). Record kept for audit.`,
      voucher
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RESTORE DELETED VOUCHER ====================
// Admin can un-delete a voucher that was soft-deleted.
exports.restoreVoucher = async (req, res) => {
  try {
    const voucher = await PaymentVoucher.findById(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status !== 'deleted') return res.status(400).json({ error: 'Voucher is not deleted' });

    voucher.status = 'issued';
    voucher.deletedReason = '';
    voucher.deletedAt = null;
    voucher.deletedBy = '';
    await voucher.save();

    res.json({ success: true, message: 'Voucher restored', voucher });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};