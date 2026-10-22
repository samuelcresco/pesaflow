const SavingRequest = require('../models/SavingRequest');
const Saving = require('../models/Saving');
const Member = require('../models/Member');
const Account = require('../models/Account');
const Receipt = require('../models/Receipt');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { createJournalEntry } = require('../utils/journalHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

const CATEGORY_ACCOUNT = {
  monthly: '1010',
  extra: '1010',
  misc: '1060',
  penalty: '1050'
};

const CATEGORY_LABEL = {
  monthly: 'Monthly Savings',
  extra: 'Extra Savings',
  misc: 'Miscellaneous',
  penalty: 'Penalty'
};

// ==================== MEMBER: SUBMIT DEPOSIT REQUEST ====================
exports.submitDepositRequest = async (req, res) => {
  try {
    const memberId = req.params.id;
    const { category, amount, note } = req.body;

    if (!['monthly', 'extra', 'misc', 'penalty'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const amt = Number(amount) || 0;
    if (amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const request = await SavingRequest.create({
      memberId: member._id,
      memberName: `${member.firstName} ${member.surname}`,
      memberNumber: member.memberNumber,
      category,
      amount: amt,
      note: note || ''
    });

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted. Awaiting admin approval after receiving the money.',
      request
    });
  } catch (error) {
    console.error('submitDepositRequest error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== MEMBER: MY DEPOSIT REQUESTS ====================
exports.getMyDepositRequests = async (req, res) => {
  try {
    const requests = await SavingRequest.find({ memberId: req.params.id }).sort('-requestedAt');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: GET ALL ====================
exports.getAllSavingRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const requests = await SavingRequest.find(filter).sort('-requestedAt').limit(500);
    const pendingCount = await SavingRequest.countDocuments({ status: 'pending' });

    res.json({ requests, pendingCount, total: requests.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: APPROVE ====================
exports.approveSavingRequest = async (req, res) => {
  try {
    const request = await SavingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const member = await Member.findById(request.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Create the real Saving
    const saving = await Saving.create({
      memberId: member._id,
      category: request.category,
      amount: request.amount,
      description: request.note || `${CATEGORY_LABEL[request.category]} (via portal)`,
      date: new Date()
    });

    // For monthly/extra, add to member savings
    if (['monthly', 'extra'].includes(request.category)) {
      member.savings = (Number(member.savings) || 0) + request.amount;
      await member.save();
    }

    // Bump the right account (misc/penalty go to club capital accounts; monthly/extra go to 1010)
    const code = CATEGORY_ACCOUNT[request.category];
    let acc = await Account.findOne({ code });
    if (!acc) {
      acc = await Account.create({ code, name: CATEGORY_LABEL[request.category], type: 'Equity', balance: request.amount });
    } else {
      acc.balance = (Number(acc.balance) || 0) + request.amount;
      await acc.save();
    }

    // Journal entry
    try {
      const lines = (request.category === 'monthly' || request.category === 'extra')
        ? [
            { accountCode: '1000', debit: request.amount },
            { accountCode: '1010', credit: request.amount }
          ]
        : [
            { accountCode: '1000', debit: request.amount },
            { accountCode: code, credit: request.amount }
          ];
      await createJournalEntry({
        date: new Date(),
        description: `${CATEGORY_LABEL[request.category]} deposit — ${member.firstName} ${member.surname}`,
        sourceType: 'savings',
        lines
      });
    } catch (e) { console.error('Saving request journal:', e.message); }

    // Receipt
    let receipt = null;
    try {
      const receiptNumber = await generateReceiptNumber(new Date());
      receipt = await Receipt.create({
        receiptNumber,
        type: 'savings_deposit',
        memberId: member._id,
        memberName: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        amount: request.amount,
        description: `${CATEGORY_LABEL[request.category]} deposit (portal request)`,
        category: request.category,
        lineItems: [{
          label: CATEGORY_LABEL[request.category],
          category: request.category,
          amount: request.amount,
          description: request.note || ''
        }],
        referenceId: request._id,
        referenceModel: 'SavingRequest',
        referenceNumber: request.memberNumber,
        date: new Date(),
        issuedBy: 'admin',
        issuedByName: req.body.approvedBy || 'Admin',
        status: 'issued'
      });
    } catch (e) { console.error('Saving request receipt:', e.message); }

    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = req.body.approvedBy || 'admin';
    request.savingId = saving._id;
    request.receiptNumber = receipt ? receipt.receiptNumber : '';
    await request.save();

    res.json({
      success: true,
      message: `Approved ${fmt(request.amount)} ${CATEGORY_LABEL[request.category]} deposit`,
      request,
      receipt: receipt ? { receiptNumber: receipt.receiptNumber } : null
    });
  } catch (error) {
    console.error('approveSavingRequest error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== ADMIN: REJECT ====================
exports.rejectSavingRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const request = await SavingRequest.findById(req.params.id);
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