const Saving = require('../models/Saving');
const Member = require('../models/Member');
const ClubSetting = require('../models/ClubSetting');
const Leader = require('../models/Leader');
const Receipt = require('../models/Receipt');
const Account = require('../models/Account');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { getLeaderSignature } = require('../utils/leaderHelper');
const { getMemberAccountCode, ensureMemberAccount } = require('../utils/memberAccountHelper');
const { writeMemberSavingsJournal } = require('../utils/journalHelper');
const PDFDocument = require('pdfkit');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

const CLUB_CAPITAL_CATEGORIES = ['misc', 'donation', 'penalty', 'business_profit', 'shares', 'membership'];

const CATEGORY_ACCOUNT_MAP = {
  membership: '1020',
  shares: '1030',
  constitution: '1040',
  penalty: '1050',
  misc: '1060',
  donation: '1070',
  business_profit: '1000'
};

const CLUB_CAPITAL_ACCOUNTS = ['1000', '1020', '1030', '1040', '1050', '1060', '1070'];

async function bumpAccountByCategory(category, delta) {
  try {
    const code = CATEGORY_ACCOUNT_MAP[category] || '1000';
    let acc = await Account.findOne({ code });
    if (!acc) {
      acc = await Account.create({
        code,
        name: category,
        type: 'Equity',
        balance: Math.max(0, Number(delta) || 0)
      });
    } else {
      acc.balance = Math.max(0, (Number(acc.balance) || 0) + Number(delta || 0));
      await acc.save();
    }
    return acc.balance;
  } catch (err) {
    console.error('Account bump error:', err.message);
    return null;
  }
}

function drawHeader(doc, title) {
  doc.rect(0, 0, doc.page.width, 90).fill('#0f3460');
  doc.fillColor('#fff').fontSize(20).text('CRESTED SS INVESTMENT CLUB LTD', 50, 25, { align: 'left' });
  doc.fontSize(11).text(title, 50, 55);
  doc.fillColor('#000').moveDown(3);
}

async function drawSignatures(doc, requestedSigs) {
  let signatories = requestedSigs && requestedSigs.length > 0
    ? requestedSigs
    : ['treasurer', 'president'];

  doc.moveDown(2);
  const y = doc.y + 10;
  const w = (doc.page.width - 100) / signatories.length;

  for (let i = 0; i < signatories.length; i++) {
    const role = signatories[i];
    const x = 50 + (i * w);

    const leader = await Leader.findOne({ role, active: true });
    const sigBuffer = await getLeaderSignature(role);

    doc.moveTo(x, y).lineTo(x + w - 30, y).strokeColor('#1e293b').lineWidth(0.8).stroke();

    if (sigBuffer) {
      try {
        doc.image(sigBuffer, x, y - 22, { fit: [w - 30, 20], align: 'center', valign: 'bottom' });
      } catch (e) {}
    }

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f3460');
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, y + 5, { width: w - 30, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
    doc.text(leader?.name || '__________________', x, y + 20, { width: w - 30, align: 'center' });

    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text('Date: ______________', x, y + 35, { width: w - 30, align: 'center' });
  }
}

async function autoCreateReceipt({ category, memberId, memberName, memberNumber, amount, description, shareType, shareQuantity, membershipType, donationType, donorName, savingId, date }) {
  try {
    const typeMap = {
      monthly: 'savings_deposit',
      extra: 'savings_deposit',
      misc: 'savings_deposit',
      penalty: 'penalty',
      membership: 'membership_fee',
      shares: 'share_purchase',
      donation: donationType === 'external' ? 'external_donation' : 'savings_deposit',
      business_profit: 'fund_transfer'
    };

    const receiptType = typeMap[category] || 'savings_deposit';

    let receiptNumber;
    try {
      receiptNumber = await generateReceiptNumber(date ? new Date(date) : new Date());
    } catch (err) {
      receiptNumber = await generateReceiptNumber(date ? new Date(date) : new Date());
    }

    const finalName = memberName || donorName || '';

    await Receipt.create({
      receiptNumber,
      type: receiptType,
      memberId: memberId || null,
      memberName: finalName,
      memberNumber: memberNumber || '',
      amount: Number(amount) || 0,
      description: description || '',
      category: category || '',
      referenceId: savingId || null,
      referenceModel: 'Saving',
      referenceNumber: savingId ? String(savingId).slice(-8) : '',
      date: date ? new Date(date) : new Date(),
      issuedBy: 'admin',
      issuedByName: ''
    });
  } catch (err) {
    console.error('Auto receipt error:', err.message);
  }
}

// ==================== ADD SAVING ====================
exports.addSaving = async (req, res) => {
  try {
    const {
      memberId, category, amount, description, month,
      shareType, shareQuantity, date,
      donationType, donorName, membershipType, paymentType,
      paymentMethod
    } = req.body;

    const memberRequired = ['monthly', 'extra', 'penalty', 'membership', 'shares', 'misc'];
    const requiresMember =
      memberRequired.includes(category) ||
      (category === 'donation' && donationType === 'member');

    if (requiresMember && (!memberId || memberId.trim() === '')) {
      return res.status(400).json({ error: 'Member required' });
    }

    const method = ['cash', 'bank', 'mobile_money'].includes(paymentMethod) ? paymentMethod : 'cash';

    let finalAmount = Number(amount) || 0;

    if (category === 'membership') {
      const year = new Date().getFullYear();
      const setting = await ClubSetting.findOne({ year });
      const type = membershipType || paymentType || 'first_time';
      if (setting) {
        if (type === 'renewal' && setting.membershipRenewalFee) {
          finalAmount = setting.membershipRenewalFee;
        } else if (setting.membershipFee) {
          finalAmount = setting.membershipFee;
        }
      }
    }

    if (finalAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const saving = new Saving({
      memberId: requiresMember ? memberId : null,
      category,
      amount: finalAmount,
      description: description || '',
      donorName: donorName || '',
      donationType: donationType || '',
      membershipType: membershipType || paymentType || '',
      month: month || '',
      shareType: shareType || '',
      shareQuantity: shareQuantity || 0,
      date: date ? new Date(date) : new Date(),
      paymentMethod: method
    });

    await saving.save();

    let memberName = '';
    let memberNumber = '';
    let memberDoc = null;

    if (['monthly', 'extra'].includes(category) && memberId) {
      const member = await Member.findById(memberId);
      if (member) {
        member.savings = (Number(member.savings) || 0) + finalAmount;
        await member.save();
        memberName = `${member.firstName} ${member.surname}`;
        memberNumber = member.memberNumber;
        memberDoc = member;
      }
    }

    if (category === 'shares' && memberId && shareType && shareQuantity) {
      const member = await Member.findById(memberId);
      if (member) {
        member.shares[shareType] = (member.shares[shareType] || 0) + shareQuantity;
        await member.save();
        memberName = `${member.firstName} ${member.surname}`;
        memberNumber = member.memberNumber;
      }
    }

    if (memberId && !memberName) {
      const member = await Member.findById(memberId);
      if (member) {
        memberName = `${member.firstName} ${member.surname}`;
        memberNumber = member.memberNumber;
        memberDoc = memberDoc || member;
      }
    }

    if (CLUB_CAPITAL_CATEGORIES.includes(category)) {
      await bumpAccountByCategory(category, finalAmount);
    }

    if (['monthly', 'extra'].includes(category) && memberDoc) {
      try {
        const code = getMemberAccountCode(memberDoc.memberNumber);
        if (code) {
          await ensureMemberAccount(memberDoc);
          await writeMemberSavingsJournal({
            memberAccountCode: code,
            memberAccountName: `Member Savings — ${memberDoc.firstName} ${memberDoc.surname} (${memberDoc.memberNumber})`,
            amount: finalAmount,
            direction: 'deposit',
            date: saving.date,
            description: `${category} savings — ${memberDoc.firstName} ${memberDoc.surname}${description ? ` — ${description}` : ''}`,
            sourceType: `saving_${category}`,
            paymentMethod: method
          });
        } else {
          console.warn(`[addSaving] No account code for ${memberDoc.memberNumber} — journal skipped`);
        }
      } catch (jErr) {
        console.error('[addSaving] Journal error:', jErr.message);
      }
    }

    await autoCreateReceipt({
      category,
      memberId,
      memberName,
      memberNumber,
      amount: finalAmount,
      description,
      shareType,
      shareQuantity,
      membershipType,
      donationType,
      donorName,
      savingId: saving._id,
      date: saving.date
    });

    res.status(201).json({ success: true, saving });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL ====================
exports.getAllSavings = async (req, res) => {
  try {
    const savings = await Saving.find()
      .populate('memberId', 'firstName surname memberNumber')
      .sort('-date');
    res.json(savings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SUMMARY ====================
exports.getSummary = async (req, res) => {
  try {
    const all = await Saving.find();
    const total = all.reduce((s, x) => s + Number(x.amount || 0), 0);

    const memberTotal = all
      .filter(s => ['monthly', 'extra'].includes(s.category))
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const accs = await Account.find({ code: { $in: CLUB_CAPITAL_ACCOUNTS } });
    const capitalTotal = accs.reduce((s, a) => s + (Number(a.balance) || 0), 0);

    res.json({
      generalSavings: total,
      memberSavings: memberTotal,
      clubCapital: capitalTotal
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER SAVINGS TABLE ====================
exports.getMemberSavingsList = async (req, res) => {
  try {
    const members = await Member.find();
    const all = await Saving.find();

    const result = members.map(m => {
      const ms = all.filter(s => s.memberId && s.memberId.toString() === m._id.toString());
      const monthly = ms.filter(s => s.category === 'monthly').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const extra = ms.filter(s => s.category === 'extra').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const penalties = ms.filter(s => s.category === 'penalty').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const membership = ms.filter(s => s.category === 'membership').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const sharesValue = ms.filter(s => s.category === 'shares').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const misc = ms.filter(s => s.category === 'misc').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const donation = ms.filter(s => s.category === 'donation').reduce((sum, s) => sum + Number(s.amount || 0), 0);

      return {
        _id: m._id,
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.surname}`,
        monthlySavings: monthly,
        extraSavings: extra,
        totalSavings: monthly + extra,
        penalties, membership, sharesValue, misc, donation
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== AGREED SAVINGS ====================
exports.getAgreedSavings = async (req, res) => {
  try {
    const settings = await ClubSetting.find().sort('-year');
    const agreed = settings.map(s => ({
      _id: s._id,
      year: s.year,
      amount: s.agreedMonthlyAmount || 0,
      membershipFee: s.membershipFee || 0,
      membershipRenewalFee: s.membershipRenewalFee || 0
    }));
    res.json(agreed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBERSHIP FEES ====================
exports.getMembershipFees = async (req, res) => {
  try {
    const setting = await ClubSetting.findOne().sort('-year');
    res.json({
      firstTime: setting?.membershipFee || 0,
      renewal: setting?.membershipRenewalFee || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SET AGREED MONTHLY ====================
exports.setAgreedMonthly = async (req, res) => {
  try {
    const { year, amount } = req.body;
    let setting = await ClubSetting.findOne({ year });
    if (setting) setting.agreedMonthlyAmount = amount;
    else setting = new ClubSetting({ year, agreedMonthlyAmount: amount });
    await setting.save();
    res.json({ success: true, setting });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== SET MEMBERSHIP FEES ====================
exports.setMembershipFees = async (req, res) => {
  try {
    const { year, firstTime, renewal } = req.body;
    let setting = await ClubSetting.findOne({ year });
    if (!setting) setting = new ClubSetting({ year });
    if (firstTime !== undefined) setting.membershipFee = firstTime;
    if (renewal !== undefined) setting.membershipRenewalFee = renewal;
    await setting.save();
    res.json({ success: true, setting });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== SET MEMBERSHIP FEE (legacy) ====================
exports.setMembershipFee = async (req, res) => {
  try {
    const { year, amount } = req.body;
    let setting = await ClubSetting.findOne({ year });
    if (setting) setting.membershipFee = amount;
    else setting = new ClubSetting({ year, membershipFee: amount });
    await setting.save();
    res.json({ success: true, setting });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET SETTINGS ====================
exports.getSettings = async (req, res) => {
  try {
    const settings = await ClubSetting.find().sort('-year');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELETE SAVING ====================
exports.deleteSaving = async (req, res) => {
  try {
    const saving = await Saving.findById(req.params.id);
    if (!saving) return res.status(404).json({ error: 'Transaction not found' });

    let memberDoc = null;

    if (['monthly', 'extra'].includes(saving.category) && saving.memberId) {
      const member = await Member.findById(saving.memberId);
      if (member) {
        member.savings = Math.max(0, (Number(member.savings) || 0) - Number(saving.amount || 0));
        await member.save();
        memberDoc = member;
      }
    }

    if (saving.category === 'shares' && saving.memberId && saving.shareType) {
      const member = await Member.findById(saving.memberId);
      if (member) {
        member.shares[saving.shareType] = Math.max(0, (member.shares[saving.shareType] || 0) - (saving.shareQuantity || 0));
        await member.save();
      }
    }

    if (CLUB_CAPITAL_CATEGORIES.includes(saving.category)) {
      await bumpAccountByCategory(saving.category, -Number(saving.amount || 0));
    }

    if (['monthly', 'extra'].includes(saving.category) && memberDoc) {
      try {
        const code = getMemberAccountCode(memberDoc.memberNumber);
        if (code) {
          await ensureMemberAccount(memberDoc);
          await writeMemberSavingsJournal({
            memberAccountCode: code,
            memberAccountName: `Member Savings — ${memberDoc.firstName} ${memberDoc.surname} (${memberDoc.memberNumber})`,
            amount: Number(saving.amount || 0),
            direction: 'withdrawal',
            date: new Date(),
            description: `Reversal — ${saving.category} savings — ${memberDoc.firstName} ${memberDoc.surname}${saving.description ? ` — ${saving.description}` : ''}`,
            sourceType: 'saving_delete',
            paymentMethod: saving.paymentMethod || 'cash'
          });
        }
      } catch (jErr) {
        console.error('[deleteSaving] Journal reversal error:', jErr.message);
      }
    }

    await Saving.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER STATEMENT PDF ====================
exports.downloadMemberStatement = async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const savings = await Saving.find({ memberId: member._id }).sort('date');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=statement-${member.memberNumber}.pdf`);
    doc.pipe(res);

    drawHeader(doc, 'Member Savings Statement');

    doc.fillColor('#000').fontSize(11);
    doc.text(`Member: ${member.firstName} ${member.surname}`, 50, 110);
    doc.text(`Member No: ${member.memberNumber}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    const startY = doc.y;
    doc.rect(50, startY, doc.page.width - 100, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(10);
    doc.text('Date', 60, startY + 6);
    doc.text('Category', 140, startY + 6);
    doc.text('Description', 240, startY + 6);
    doc.text('Amount (UGX)', 420, startY + 6, { width: 100, align: 'right' });
    doc.moveDown();

    let total = 0;
    let y = startY + 26;
    doc.fillColor('#000');
    savings.forEach((s, i) => {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 20).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);
      doc.text(new Date(s.date).toLocaleDateString(), 60, y);
      doc.text(s.category, 140, y);
      doc.text(s.description || '—', 240, y, { width: 170 });
      doc.text(fmt(s.amount), 420, y, { width: 100, align: 'right' });
      total += Number(s.amount || 0);
      y += 20;
    });

    doc.moveDown();
    doc.rect(50, y + 5, doc.page.width - 100, 25).fill('#dcfce7');
    doc.fillColor('#065f46').fontSize(12).font('Helvetica-Bold');
    doc.text('TOTAL SAVINGS:', 60, y + 12);
    doc.text(`UGX ${fmt(total)}`, 380, y + 12, { width: 140, align: 'right' });
    doc.font('Helvetica');

    doc.y = y + 40;
    await drawSignatures(doc, requestedSigs);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CLUB CAPITAL PDF ====================
exports.downloadClubCapitalReport = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const capital = await Saving.find({
      category: { $in: CLUB_CAPITAL_CATEGORIES }
    }).populate('memberId', 'firstName surname').sort('date');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=club-capital-report.pdf');
    doc.pipe(res);

    drawHeader(doc, 'Club Capital Report');

    doc.fillColor('#000').fontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 110);
    doc.moveDown();

    const startY = doc.y;
    doc.rect(50, startY, doc.page.width - 100, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(10);
    doc.text('Date', 60, startY + 6);
    doc.text('Member', 130, startY + 6);
    doc.text('Category', 220, startY + 6);
    doc.text('Description', 300, startY + 6);
    doc.text('Amount (UGX)', 420, startY + 6, { width: 100, align: 'right' });
    doc.moveDown();

    let total = 0;
    let y = startY + 26;
    doc.fillColor('#000');
    capital.forEach((s, i) => {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 20).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);
      doc.text(new Date(s.date).toLocaleDateString(), 60, y);
      const mname = s.memberId ? `${s.memberId.firstName || ''} ${s.memberId.surname || ''}`.trim() : (s.donorName || 'Club');
      doc.text(mname || '—', 130, y, { width: 85 });
      doc.text(s.category, 220, y);
      doc.text(s.description || '—', 300, y, { width: 110 });
      doc.text(fmt(s.amount), 420, y, { width: 100, align: 'right' });
      total += Number(s.amount || 0);
      y += 20;
    });

    doc.moveDown();
    doc.rect(50, y + 5, doc.page.width - 100, 25).fill('#fef9e7');
    doc.fillColor('#b45309').fontSize(12).font('Helvetica-Bold');
    doc.text('TOTAL CLUB CAPITAL:', 60, y + 12);
    doc.text(`UGX ${fmt(total)}`, 380, y + 12, { width: 140, align: 'right' });
    doc.font('Helvetica');

    doc.y = y + 40;
    await drawSignatures(doc, requestedSigs);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GENERAL REPORT PDF ====================
exports.downloadGeneralReport = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const all = await Saving.find().populate('memberId', 'firstName surname memberNumber').sort('date');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=general-savings-report.pdf');
    doc.pipe(res);

    drawHeader(doc, 'General Savings Report');

    doc.fillColor('#000').fontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 110);
    doc.text(`Total Transactions: ${all.length}`);
    doc.moveDown();

    const startY = doc.y;
    doc.rect(50, startY, doc.page.width - 100, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(9);
    doc.text('Date', 60, startY + 6);
    doc.text('Member', 120, startY + 6);
    doc.text('Category', 220, startY + 6);
    doc.text('Description', 300, startY + 6);
    doc.text('Amount', 420, startY + 6, { width: 100, align: 'right' });
    doc.moveDown();

    let total = 0;
    let y = startY + 26;
    doc.fillColor('#000');
    all.forEach((s, i) => {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 20).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);
      doc.text(new Date(s.date).toLocaleDateString(), 60, y);
      const mname = s.memberId ? `${s.memberId.firstName || ''} ${s.memberId.surname || ''}`.trim() : (s.donorName || 'Club');
      doc.text(mname || '—', 120, y, { width: 95 });
      doc.text(s.category, 220, y);
      doc.text(s.description || '—', 300, y, { width: 110 });
      doc.text(fmt(s.amount), 420, y, { width: 100, align: 'right' });
      total += Number(s.amount || 0);
      y += 20;
    });

    doc.moveDown();
    doc.rect(50, y + 5, doc.page.width - 100, 25).fill('#e0f2fe');
    doc.fillColor('#0369a1').fontSize(12).font('Helvetica-Bold');
    doc.text('GRAND TOTAL:', 60, y + 12);
    doc.text(`UGX ${fmt(total)}`, 380, y + 12, { width: 140, align: 'right' });
    doc.font('Helvetica');

    doc.y = y + 40;
    await drawSignatures(doc, requestedSigs);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXTERNAL DONATIONS ====================
exports.getExternalDonations = async (req, res) => {
  try {
    const donations = await Saving.find({
      category: 'donation',
      donationType: 'external'
    }).sort('-date');

    const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);

    res.json({ donations, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXTERNAL DONATIONS PDF ====================
exports.externalDonationsPDF = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const donations = await Saving.find({
      category: 'donation',
      donationType: 'external'
    }).sort('-date');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=external-donations.pdf');
    doc.pipe(res);

    drawHeader(doc, 'External Donations Report');

    doc.fillColor('#000').fontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 110);
    doc.text(`Total Donations: UGX ${fmt(donations.reduce((s, d) => s + Number(d.amount || 0), 0))}`);
    doc.moveDown();

    const startY = doc.y;
    doc.rect(50, startY, doc.page.width - 100, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(10);
    doc.text('Date', 60, startY + 6);
    doc.text('Donor Name', 150, startY + 6);
    doc.text('Description', 320, startY + 6);
    doc.text('Amount (UGX)', 430, startY + 6, { width: 100, align: 'right' });
    doc.moveDown();

    let total = 0;
    let y = startY + 26;
    doc.fillColor('#000');
    donations.forEach((d, i) => {
      if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 20).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);
      doc.text(new Date(d.date).toLocaleDateString(), 60, y);
      doc.text(d.donorName || 'Anonymous', 150, y, { width: 160 });
      doc.text(d.description || '—', 320, y, { width: 100 });
      doc.text(fmt(d.amount), 430, y, { width: 100, align: 'right' });
      total += Number(d.amount || 0);
      y += 20;
    });

    doc.moveDown();
    doc.rect(50, y + 5, doc.page.width - 100, 25).fill('#fef9e7');
    doc.fillColor('#b45309').fontSize(12).font('Helvetica-Bold');
    doc.text('TOTAL EXTERNAL DONATIONS:', 60, y + 12);
    doc.text(`UGX ${fmt(total)}`, 380, y + 12, { width: 140, align: 'right' });
    doc.font('Helvetica');

    doc.y = y + 40;
    await drawSignatures(doc, requestedSigs);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELETE CLUB SETTING (by year) ====================
exports.deleteClubSetting = async (req, res) => {
  try {
    const { year } = req.params;
    const setting = await ClubSetting.findOne({ year: parseInt(year) });
    if (!setting) return res.status(404).json({ error: 'No settings found for year ' + year });

    await ClubSetting.deleteOne({ year: parseInt(year) });
    res.json({ success: true, message: `Settings for ${year} deleted` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};