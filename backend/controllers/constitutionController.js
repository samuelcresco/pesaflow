const Constitution = require('../models/Constitution');
const Member = require('../models/Member');
const ShareSettings = require('../models/shareSettings.models');

// ==================== HELPER: find constitution (active, or newest if none active) ====================
async function findConstitution({ withPdf = false } = {}) {
  let doc = await Constitution.findOne({ active: true });
  if (!doc) doc = await Constitution.findOne().sort('-createdAt');
  if (!doc) return null;
  if (!withPdf) doc = doc.toObject ? doc.toObject() : doc;
  return doc;
}

// ==================== ADMIN: UPLOAD ====================
exports.uploadConstitution = async (req, res) => {
  try {
    const { title, version, pdfData, fileName, fileSize } = req.body;
    if (!pdfData || !pdfData.startsWith('data:')) {
      return res.status(400).json({ error: 'Invalid PDF data' });
    }
    await Constitution.updateMany({}, { $set: { active: false } });

    const doc = await Constitution.create({
      title: title || 'Club Constitution',
      version: version || '1.0',
      pdfData,
      fileName: fileName || 'constitution.pdf',
      fileSize: fileSize || 0,
      uploadedBy: req.user?.id || 'admin',
      active: true
    });

    res.json({
      success: true,
      message: 'Constitution uploaded',
      constitution: {
        _id: doc._id,
        title: doc.title,
        version: doc.version,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        updatedAt: doc.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: GET INFO ====================
exports.getConstitutionInfo = async (req, res) => {
  try {
    const doc = await findConstitution();
    const shareSettings = await ShareSettings.findOne() || {};
    res.json({
      constitution: doc ? {
        _id: doc._id,
        title: doc.title,
        version: doc.version,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        updatedAt: doc.updatedAt,
        active: !!doc.active
      } : null,
      fee: Number(shareSettings.constitutionFee) || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: DELETE ====================
exports.deleteConstitution = async (req, res) => {
  try {
    await Constitution.updateMany({}, { $set: { active: false } });
    res.json({ success: true, message: 'Constitution removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: ACCESS LIST ====================
exports.getAccessList = async (req, res) => {
  try {
    const members = await Member.find()
      .select('firstName surname memberNumber contact savings lockedSavings constitutionPaid constitutionPaidDate constitutionPaidAmount')
      .sort('memberNumber');
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: MARK PAID / UNPAID ====================
exports.setMemberAccess = async (req, res) => {
  try {
    const { paid, amount, paymentMethod } = req.body;
    const member = await Member.findById(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const wasAlreadyPaid = !!member.constitutionPaid;
    const payAmount = Number(amount) || 0;
    const method = paymentMethod === 'savings' ? 'savings' : 'cash';

    if (!paid) {
      if (!wasAlreadyPaid) {
        return res.json({ success: true, message: 'Already unpaid' });
      }

      const Saving = require('../models/Saving');
      const Account = require('../models/Account');
      const Receipt = require('../models/Receipt');
      const { createJournalEntry } = require('../utils/journalHelper');

      const consSavings = await Saving.find({
        memberId: member._id,
        category: 'constitution'
      }).sort('-date');

      let restoredFromSavings = 0;
      let totalToReverse = 0;

      for (const s of consSavings) {
        const amt = Math.abs(Number(s.amount) || 0);
        totalToReverse += amt;
        const desc = (s.description || '').toLowerCase();
        const wasSavingsPayment = desc.includes('from savings') || desc.includes('savings');
        if (wasSavingsPayment) {
          member.savings = (Number(member.savings) || 0) + amt;
          restoredFromSavings += amt;
        }
      }

      if (totalToReverse === 0 && Number(member.constitutionPaidAmount) > 0) {
        totalToReverse = Number(member.constitutionPaidAmount);
      }

      let consAcc = await Account.findOne({ code: '1040' });
      if (consAcc && totalToReverse > 0) {
        consAcc.balance = Math.max(0, (Number(consAcc.balance) || 0) - totalToReverse);
        await consAcc.save();
      }

      for (const s of consSavings) {
        const amt = Math.abs(Number(s.amount) || 0);
        const desc = (s.description || '').toLowerCase();
        const wasSavingsPayment = desc.includes('from savings') || desc.includes('savings');
        try {
          const lines = wasSavingsPayment
            ? [{ accountCode: '1040', debit: amt }, { accountCode: '1010', credit: amt }]
            : [{ accountCode: '1040', debit: amt }, { accountCode: '1000', credit: amt }];
          await createJournalEntry({
            date: new Date(),
            description: `Reversal: Constitution fee (${wasSavingsPayment ? 'savings' : 'cash'}) — ${member.firstName} ${member.surname}`,
            sourceType: 'savings',
            lines
          });
        } catch (e) { console.error('Reversal journal:', e.message); }
      }

      if (consSavings.length > 0) {
        await Saving.deleteMany({ _id: { $in: consSavings.map(s => s._id) } });
      }

      try {
        await Receipt.updateMany(
          { memberId: member._id, type: 'constitution_fee' },
          { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledReason: 'Constitution payment reversed by admin' } }
        );
      } catch (e) { console.error('Receipt cancel:', e.message); }

      member.constitutionPaid = false;
      member.constitutionPaidDate = null;
      member.constitutionPaidAmount = 0;
      await member.save();

      return res.json({
        success: true,
        message: 'Marked as unpaid — payment reversed',
        reversed: { totalRemovedFromConstitutionAccount: totalToReverse, restoredToMemberSavings: restoredFromSavings },
        member: { _id: member._id, constitutionPaid: false, savings: member.savings }
      });
    }

    if (paid && wasAlreadyPaid) {
      return res.json({ success: true, message: 'Already paid' });
    }

    if (payAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    if (method === 'savings') {
      const availableSavings = (Number(member.savings) || 0) - (Number(member.lockedSavings) || 0);
      if (availableSavings < payAmount) {
        return res.status(400).json({ error: `Insufficient savings. Available: UGX ${availableSavings.toLocaleString()}` });
      }
      member.savings = Number(member.savings) - payAmount;
    }

    member.constitutionPaid = true;
    member.constitutionPaidDate = new Date();
    member.constitutionPaidAmount = payAmount;
    await member.save();

    let receipt = null;

    const Account = require('../models/Account');
    const Saving = require('../models/Saving');
    const Receipt = require('../models/Receipt');
    const { generateReceiptNumber } = require('../utils/receiptNumber');
    const { createJournalEntry } = require('../utils/journalHelper');

    let consAcc = await Account.findOne({ code: '1040' });
    if (!consAcc) {
      consAcc = await Account.create({ code: '1040', name: 'Constitution Fees', type: 'Equity', balance: payAmount });
    } else {
      consAcc.balance = (Number(consAcc.balance) || 0) + payAmount;
      await consAcc.save();
    }

    try {
      const lines = method === 'savings'
        ? [{ accountCode: '1010', debit: payAmount }, { accountCode: '1040', credit: payAmount }]
        : [{ accountCode: '1000', debit: payAmount }, { accountCode: '1040', credit: payAmount }];
      await createJournalEntry({
        date: new Date(),
        description: `Constitution fee (${method}) — ${member.firstName} ${member.surname}`,
        sourceType: 'savings',
        lines
      });
    } catch (e) { console.error('Constitution journal:', e.message); }

    try {
      await Saving.create({
        memberId: member._id,
        category: 'constitution',
        amount: payAmount,
        description: method === 'savings' ? 'Constitution fee (from savings)' : 'Constitution fee (cash)',
        date: new Date()
      });
    } catch (e) { console.error('Constitution Saving record:', e.message); }

    try {
      const receiptNumber = await generateReceiptNumber(new Date());
      receipt = await Receipt.create({
        receiptNumber,
        type: 'constitution_fee',
        memberId: member._id,
        memberName: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        amount: payAmount,
        description: method === 'savings' ? 'Constitution Fee (paid from savings)' : 'Constitution Fee (cash)',
        category: 'constitution',
        lineItems: [{
          label: 'Constitution Fee',
          category: 'constitution',
          amount: payAmount,
          description: method === 'savings' ? 'Deducted from savings' : 'Paid in cash'
        }],
        referenceId: member._id,
        referenceModel: 'Member',
        referenceNumber: member.memberNumber,
        date: new Date(),
        issuedBy: 'admin',
        issuedByName: 'Admin',
        notes: `Method: ${method}`,
        status: 'issued'
      });
    } catch (e) { console.error('Constitution receipt:', e.message); }

    return res.json({
      success: true,
      message: 'Marked as paid',
      member: {
        _id: member._id,
        constitutionPaid: true,
        constitutionPaidDate: member.constitutionPaidDate,
        constitutionPaidAmount: member.constitutionPaidAmount,
        savings: member.savings
      },
      receipt: receipt ? { _id: receipt._id, receiptNumber: receipt.receiptNumber } : null
    });

  } catch (error) {
    console.error('setMemberAccess error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER: STATUS ====================
exports.getMyStatus = async (req, res) => {
  try {
    const memberId = req.user?.id || req.params.memberId || req.query.memberId;
    const member = await Member.findById(memberId);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const doc = await findConstitution();
    const shareSettings = await ShareSettings.findOne() || {};

    res.json({
      hasConstitution: !!doc,
      constitution: doc ? {
        title: doc.title,
        version: doc.version,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        updatedAt: doc.updatedAt
      } : null,
      fee: Number(shareSettings.constitutionFee) || 0,
      paid: !!member.constitutionPaid,
      paidDate: member.constitutionPaidDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER: DOWNLOAD ====================
exports.downloadConstitution = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const memberId = req.user?.id || req.params.memberId || req.query.memberId;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    if (!member.constitutionPaid) {
      return res.status(402).json({ error: 'Constitution not purchased. Please pay the club to unlock download.', locked: true });
    }

    const doc = await findConstitution({ withPdf: true });
    if (!doc) return res.status(404).json({ error: 'Constitution not uploaded yet' });
    if (!doc.pdfData) return res.status(404).json({ error: 'Constitution PDF is missing' });

    const base64 = doc.pdfData.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName || 'constitution.pdf'}"`);
    res.send(buffer);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: DOWNLOAD RAW PDF ====================
exports.adminDownloadConstitution = async (req, res) => {
  try {
    const doc = await findConstitution({ withPdf: true });
    if (!doc) return res.status(404).json({ error: 'No constitution uploaded' });

    const base64 = doc.pdfData.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName || 'constitution.pdf'}"`);
    res.send(buffer);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};