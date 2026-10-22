const ShareRequest = require('../models/ShareRequest');
const Member = require('../models/Member');
const ShareSettings = require('../models/shareSettings.models');
const Account = require('../models/Account');
const Saving = require('../models/Saving');
const Receipt = require('../models/Receipt');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { createJournalEntry } = require('../utils/journalHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// Map share type (member uses golden/platinum/silver/bronze) to share settings keys
const SETTINGS_KEY = {
  golden: 'golden',
  platinum: 'platinum',
  silver: 'silver',
  bronze: 'ordinary'
};

// ==================== MEMBER: APPLY FOR SHARES ====================
exports.applyForShares = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { shareType, quantity, paymentMethod, notes } = req.body;

    if (!['golden', 'platinum', 'silver', 'bronze'].includes(shareType)) {
      return res.status(400).json({ error: 'Invalid share type' });
    }
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const settings = await ShareSettings.findOne() || {};
    const settingsKey = SETTINGS_KEY[shareType];
    const typeSettings = settings.shareTypes?.[settingsKey] || {};
    const unitPrice = Number(typeSettings.price) || 0;
    const maxPerType = Number(typeSettings.maxShares) || 15;

    if (unitPrice <= 0) return res.status(400).json({ error: 'Share price not configured' });

    const currentOfType = Number(member.shares?.[shareType] || 0);
    if (currentOfType + qty > maxPerType) {
      return res.status(400).json({
        error: `Maximum ${maxPerType} ${shareType} shares per member. You have ${currentOfType}, requesting ${qty}.`
      });
    }

    const totalShares = ['golden', 'platinum', 'silver', 'bronze']
      .reduce((s, k) => s + Number(member.shares?.[k] || 0), 0);
    if (totalShares + qty > 15) {
      return res.status(400).json({
        error: `Total shares cannot exceed 15. You have ${totalShares}.`
      });
    }

    const amountDue = qty * unitPrice;
    const method = paymentMethod === 'savings' ? 'savings' : 'cash';

    if (method === 'savings') {
      const available = (Number(member.savings) || 0) - (Number(member.lockedSavings) || 0);
      if (available < amountDue) {
        return res.status(400).json({
          error: `Insufficient savings. Available: UGX ${fmt(available)}, needed: UGX ${fmt(amountDue)}`
        });
      }
    }

    const request = await ShareRequest.create({
      memberId: member._id,
      memberName: `${member.firstName} ${member.surname}`,
      memberNumber: member.memberNumber,
      shareType,
      quantity: qty,
      unitPrice,
      amountDue,
      paymentMethod: method,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: `Share request submitted for admin approval`,
      request
    });
  } catch (error) {
    console.error('applyForShares error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== MEMBER: MY REQUESTS ====================
exports.getMyShareRequests = async (req, res) => {
  try {
    const requests = await ShareRequest.find({ memberId: req.params.id })
      .sort('-requestedAt');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: GET ALL REQUESTS ====================
exports.getAllShareRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await ShareRequest.find(filter).sort('-requestedAt').limit(500);
    const pendingCount = await ShareRequest.countDocuments({ status: 'pending' });

    res.json({ requests, pendingCount, total: requests.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: APPROVE ====================
exports.approveShareRequest = async (req, res) => {
  try {
    const request = await ShareRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const member = await Member.findById(request.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Re-check limits (in case member acquired shares since the request)
    const settings = await ShareSettings.findOne() || {};
    const settingsKey = SETTINGS_KEY[request.shareType];
    const typeSettings = settings.shareTypes?.[settingsKey] || {};
    const maxPerType = Number(typeSettings.maxShares) || 15;

    const currentOfType = Number(member.shares?.[request.shareType] || 0);
    if (currentOfType + request.quantity > maxPerType) {
      return res.status(400).json({ error: `Would exceed ${maxPerType} ${request.shareType} shares` });
    }
    const totalShares = ['golden', 'platinum', 'silver', 'bronze']
      .reduce((s, k) => s + Number(member.shares?.[k] || 0), 0);
    if (totalShares + request.quantity > 15) {
      return res.status(400).json({ error: 'Would exceed 15 total shares' });
    }

    // Handle payment
    if (request.paymentMethod === 'savings') {
      const available = (Number(member.savings) || 0) - (Number(member.lockedSavings) || 0);
      if (available < request.amountDue) {
        return res.status(400).json({ error: `Insufficient savings now: UGX ${fmt(available)}` });
      }
      member.savings = Number(member.savings) - request.amountDue;
    }

    // Add shares
    if (!member.shares) member.shares = { golden: 0, platinum: 0, silver: 0, bronze: 0 };
    member.shares[request.shareType] = Number(member.shares[request.shareType] || 0) + request.quantity;
    await member.save();

    // Bump Account 1030 (Share Capital)
    let shareAcc = await Account.findOne({ code: '1030' });
    if (!shareAcc) {
      shareAcc = await Account.create({
        code: '1030',
        name: 'Share Capital',
        type: 'Equity',
        balance: request.amountDue
      });
    } else {
      shareAcc.balance = (Number(shareAcc.balance) || 0) + request.amountDue;
      await shareAcc.save();
    }

    // Journal entry
    try {
      const lines = request.paymentMethod === 'savings'
        ? [
            { accountCode: '1010', debit: request.amountDue },
            { accountCode: '1030', credit: request.amountDue }
          ]
        : [
            { accountCode: '1000', debit: request.amountDue },
            { accountCode: '1030', credit: request.amountDue }
          ];
      await createJournalEntry({
        date: new Date(),
        description: `Share purchase (${request.shareType} × ${request.quantity}) — ${member.firstName} ${member.surname}`,
        sourceType: 'savings',
        lines
      });
    } catch (e) { console.error('Share purchase journal:', e.message); }

    // Saving record (for history)
    try {
      await Saving.create({
        memberId: member._id,
        category: 'shares',
        shareType: request.shareType,
        shareQuantity: request.quantity,
        amount: request.amountDue,
        description: `${request.shareType} shares × ${request.quantity} (${request.paymentMethod})`,
        date: new Date()
      });
    } catch (e) { console.error('Share purchase Saving record:', e.message); }

    // Receipt
    let receipt = null;
    try {
      const receiptNumber = await generateReceiptNumber(new Date());
      receipt = await Receipt.create({
        receiptNumber,
        type: 'share_purchase',
        memberId: member._id,
        memberName: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        amount: request.amountDue,
        description: `${request.shareType} shares × ${request.quantity}`,
        category: 'shares',
        lineItems: [{
          label: `${request.shareType} Shares`,
          category: 'shares',
          amount: request.amountDue,
          description: `${request.quantity} × UGX ${fmt(request.unitPrice)}`
        }],
        referenceId: request._id,
        referenceModel: 'ShareRequest',
        referenceNumber: request.memberNumber,
        date: new Date(),
        issuedBy: 'admin',
        issuedByName: req.body.approvedBy || 'Admin',
        notes: `Method: ${request.paymentMethod}`,
        status: 'issued'
      });
    } catch (e) { console.error('Share receipt:', e.message); }

    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = req.body.approvedBy || 'admin';
    await request.save();

    res.json({
      success: true,
      message: 'Share request approved',
      request,
      receipt: receipt ? { _id: receipt._id, receiptNumber: receipt.receiptNumber } : null
    });
  } catch (error) {
    console.error('approveShareRequest error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== ADMIN: REJECT ====================
exports.rejectShareRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const request = await ShareRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    request.status = 'rejected';
    request.rejectedAt = new Date();
    request.rejectedReason = reason.trim();
    await request.save();

    res.json({ success: true, message: 'Request rejected', request });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};