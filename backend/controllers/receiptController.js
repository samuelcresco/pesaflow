const Receipt = require('../models/Receipt');
const Member = require('../models/Member');
const Saving = require('../models/Saving');
const ClubSetting = require('../models/ClubSetting');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { generateReceiptPDF } = require('../utils/receiptPDF');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== CREATE RECEIPT (single item — manual) ====================
exports.createReceipt = async (req, res) => {
  try {
    const {
      type,
      memberId,
      amount,
      description,
      category,
      referenceId,
      referenceModel,
      referenceNumber,
      date,
      issuedBy,
      issuedByName,
      notes
    } = req.body;

    if (!type) return res.status(400).json({ error: 'Receipt type is required' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    let memberName = '';
    let memberNumber = '';

    if (memberId) {
      const member = await Member.findById(memberId);
      if (member) {
        memberName = `${member.firstName} ${member.surname}`;
        memberNumber = member.memberNumber;
      }
    }

    let receiptNumber;
    try {
      receiptNumber = await generateReceiptNumber(date ? new Date(date) : new Date());
    } catch (err) {
      receiptNumber = await generateReceiptNumber(date ? new Date(date) : new Date());
    }

    const receipt = await Receipt.create({
      receiptNumber,
      type,
      memberId: memberId || null,
      memberName,
      memberNumber,
      amount: Number(amount),
      description: description || '',
      category: category || '',
      lineItems: [{
        label: description || category || 'Item',
        category: category || '',
        amount: Number(amount)
      }],
      referenceId: referenceId || null,
      referenceModel: referenceModel || '',
      referenceNumber: referenceNumber || '',
      date: date ? new Date(date) : new Date(),
      issuedBy: issuedBy || 'admin',
      issuedByName: issuedByName || '',
      notes: notes || ''
    });

    res.status(201).json({ success: true, receipt });
  } catch (error) {
    console.error('CREATE RECEIPT ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== CREATE MULTI-ITEM RECEIPT ====================
// One form submission → N Saving documents + 1 combined Receipt
exports.createMultiItemReceipt = async (req, res) => {
  try {
    const {
      memberId,
      date,
      notes,
      items,
      issuedBy,
      issuedByName
    } = req.body;

    if (!memberId) return res.status(400).json({ error: 'Member is required for multi-item receipts' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const memberName = `${member.firstName} ${member.surname}`;
    const memberNumber = member.memberNumber;
    const txnDate = date ? new Date(date) : new Date();

    // ---- Validate + prepare items ----
    const preparedItems = [];
    let grandTotal = 0;

    for (const item of items) {
      const amount = Number(item.amount) || 0;
      if (amount <= 0 && (!item.shareQuantity || item.shareQuantity <= 0)) continue;

      preparedItems.push({
        category: item.category,
        amount,
        description: item.description || '',
        shareType: item.shareType || '',
        shareQuantity: Number(item.shareQuantity) || 0,
        membershipType: item.membershipType || '',
        donationType: item.donationType || '',
        donorName: item.donorName || ''
      });

      grandTotal += amount;
    }

    if (preparedItems.length === 0) {
      return res.status(400).json({ error: 'No valid items with amounts provided' });
    }

    // ---- Create Saving documents ----
    const createdSavings = [];
    const lineItems = [];

    for (const item of preparedItems) {
      const saving = new Saving({
        memberId,
        category: item.category,
        amount: item.amount,
        description: item.description,
        donationType: item.donationType,
        donorName: item.donorName,
        membershipType: item.membershipType,
        shareType: item.shareType,
        shareQuantity: item.shareQuantity,
        date: txnDate
      });
      await saving.save();
      createdSavings.push(saving);

      // Build line item label
      let label = '';
      if (item.category === 'shares') {
        const capType = item.shareType.charAt(0).toUpperCase() + item.shareType.slice(1);
        label = `${capType} Shares x ${item.shareQuantity}`;
      } else if (item.category === 'membership') {
        label = item.membershipType === 'renewal' ? 'Membership Renewal' : 'Membership (First-time)';
      } else if (item.category === 'donation') {
        label = item.donationType === 'external' ? 'External Donation' : 'Member Donation';
      } else if (item.category === 'monthly') {
        label = 'Monthly Savings';
      } else if (item.category === 'extra') {
        label = 'Extra Savings';
      } else if (item.category === 'misc') {
        label = 'Miscellaneous';
      } else if (item.category === 'penalty') {
        label = 'Penalty';
      } else {
        label = item.category.charAt(0).toUpperCase() + item.category.slice(1);
      }

      lineItems.push({
        label,
        category: item.category,
        shareType: item.shareType,
        quantity: item.shareQuantity,
        amount: item.amount,
        description: item.description,
        referenceId: saving._id
      });
    }

    // ---- Update member savings & shares ----
    for (const item of preparedItems) {
      if (item.category === 'monthly' || item.category === 'extra') {
        member.savings = (Number(member.savings) || 0) + item.amount;
      }
      if (item.category === 'shares' && item.shareType && item.shareQuantity > 0) {
        member.shares[item.shareType] = (member.shares[item.shareType] || 0) + item.shareQuantity;
      }
    }
    await member.save();

    // ---- Create ONE combined Receipt ----
    let receiptNumber;
    try {
      receiptNumber = await generateReceiptNumber(txnDate);
    } catch (err) {
      receiptNumber = await generateReceiptNumber(txnDate);
    }

    const receipt = await Receipt.create({
      receiptNumber,
      type: 'multi_item',
      memberId,
      memberName,
      memberNumber,
      amount: grandTotal,
      description: notes || `Multi-item payment (${preparedItems.length} items)`,
      category: 'multi',
      lineItems,
      date: txnDate,
      issuedBy: issuedBy || 'admin',
      issuedByName: issuedByName || '',
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      receipt,
      savingsCreated: createdSavings.length,
      grandTotal
    });
  } catch (error) {
    console.error('MULTI-ITEM RECEIPT ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL RECEIPTS ====================
exports.getAllReceipts = async (req, res) => {
  try {
    const { memberId, type, status, startDate, endDate, month, year, search } = req.query;
    const filter = {};

    if (memberId) filter.memberId = memberId;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { receiptNumber: { $regex: search, $options: 'i' } },
        { memberName: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const receipts = await Receipt.find(filter).sort('-date').limit(500);

    const totalAmount = receipts
      .filter(r => r.status === 'issued')
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    res.json({ receipts, total: receipts.length, totalAmount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY (public) ====================
exports.verifyReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findOne({ receiptNumber: req.params.number });
    if (!receipt) return res.status(404).json({ valid: false, error: 'Receipt not found' });

    res.json({
      valid: receipt.status === 'issued',
      status: receipt.status,
      receiptNumber: receipt.receiptNumber,
      type: receipt.type,
      memberName: receipt.memberName,
      memberNumber: receipt.memberNumber,
      amount: receipt.amount,
      date: receipt.date,
      issuedBy: receipt.issuedByName || receipt.issuedBy
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DOWNLOAD PDF ====================
exports.downloadReceiptPDF = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    receipt.printedCount = (receipt.printedCount || 0) + 1;
    receipt.lastPrintedAt = new Date();
    await receipt.save();

    await generateReceiptPDF(receipt, res);
  } catch (error) {
    console.error('RECEIPT PDF ERROR:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

// ==================== CANCEL RECEIPT ====================
exports.cancelReceipt = async (req, res) => {
  try {
    const { reason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status === 'cancelled') {
      return res.status(400).json({ error: 'Receipt is already cancelled' });
    }

    receipt.status = 'cancelled';
    receipt.cancelledReason = reason;
    receipt.cancelledAt = new Date();
    receipt.cancelledBy = cancelledBy || 'admin';
    await receipt.save();

    res.json({ success: true, message: 'Receipt cancelled', receipt });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE RECEIPT ====================
exports.deleteReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndDelete(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json({ success: true, message: 'Receipt permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER'S RECEIPTS ====================
exports.getMemberReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.find({
      memberId: req.params.memberId,
      status: 'issued'
    }).sort('-date');

    const total = receipts.reduce((s, r) => s + Number(r.amount || 0), 0);

    res.json({ receipts, total: receipts.length, totalAmount: total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DAILY BATCH ====================
exports.getDailyBatch = async (req, res) => {
  try {
    const { date } = req.query;
    const target = date ? new Date(date) : new Date();

    const startOfDay = new Date(target);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(target);
    endOfDay.setHours(23, 59, 59, 999);

    const receipts = await Receipt.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'issued'
    }).sort('date');

    const total = receipts.reduce((s, r) => s + Number(r.amount || 0), 0);

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      receipts,
      count: receipts.length,
      totalAmount: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};