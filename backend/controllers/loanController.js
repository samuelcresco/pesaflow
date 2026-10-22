const Loan = require('../models/Loan');
const Member = require('../models/Member');
const Repayment = require('../models/Repayment');
const Setting = require('../models/Setting');
const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const Account = require('../models/Account');
const Leader = require('../models/Leader');
const PDFDocument = require('pdfkit');
const { createJournalEntry } = require('../utils/journalHelper');
const { getLeaderSignature } = require('../utils/leaderHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== INTEREST MILESTONE CHECK ====================
async function checkInterestMilestone() {
  const interestAcc = await Account.findOne({ code: '1300' });
  if (!interestAcc) return;

  let bal = Number(interestAcc.balance) || 0;

  while (bal >= 1000000) {
    const clubAcc = await Account.findOne({ code: '1000' });
    if (!clubAcc) break;

    const transferAmount = 500000;

    interestAcc.balance = bal - transferAmount;
    clubAcc.balance = (Number(clubAcc.balance) || 0) + transferAmount;
    await interestAcc.save();
    await clubAcc.save();

    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });
    if (loanBiz) {
      try {
        await BusinessTransaction.create({
          businessId: loanBiz._id,
          type: 'profit_extraction',
          amount: transferAmount,
          description: 'Auto milestone: Interest Fund profit to Club Capital',
          sourceType: 'loan',
          date: new Date()
        });
      } catch (e) { console.error('Milestone BusinessTransaction:', e.message); }
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: `Auto milestone: UGX ${fmt(transferAmount)} Interest Fund to Club Capital`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1000', debit: transferAmount },
          { accountCode: '1300', credit: transferAmount }
        ]
      });
    } catch (e) { console.error('Milestone journal:', e.message); }

    bal = Number(interestAcc.balance) || 0;
  }
}

// ==================== ELIGIBILITY ====================
exports.getEligibility = async (req, res) => {
  try {
    const { memberId, type } = req.params;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const settings = await Setting.findOne() || {};
    const savings = Number(member.savings) || 0;
    const locked = Number(member.lockedSavings) || 0;
    const available = savings - locked;
    const maxAmount = Math.floor(available * 0.7);

    res.json({ memberSavings: savings, lockedSavings: locked, availableSavings: available, maxAmount, hasActiveLoan: !!member.activeLoanId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== APPLY LOAN ====================
exports.applyLoan = async (req, res) => {
  try {
    const { memberId, type, amount, duration, scheduleUnit, purpose } = req.body;

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.activeLoanId) return res.status(400).json({ error: 'Member has an active loan' });

    const settings = await Setting.findOne() || {};
    let interestRate;
    if (type === 'emergency') interestRate = settings.emergencyInterest || 5;
    else if (type === 'school_fees') interestRate = settings.schoolFeesInterest || 8;
    else if (type === 'business') interestRate = settings.businessInterest || 10;
    else return res.status(400).json({ error: 'Invalid loan type' });

    const durationMonths = parseInt(duration) || 1;
    const timeInYears = durationMonths / 12;
    const totalRepayable = amount + (amount * (interestRate / 100) * timeInYears);
    const feePercent = Number(settings.loanProcessingFeePercent) || 0;
    const processingFee = Math.round(Number(amount) * (feePercent / 100) * 100) / 100;

    const loan = new Loan({
      memberId, type, amount, interestRate,
      durationMonths, duration: durationMonths,
      scheduleUnit: scheduleUnit || 'weekly',
      totalRepayable: Math.round(totalRepayable * 100) / 100,
      purpose: purpose || '', status: 'pending', appliedBy: 'member',
      processingFee,
      processingFeePercent: feePercent,
      netDisbursed: Math.max(0, Number(amount) - processingFee)
    });
    await loan.save();

    const unit = scheduleUnit || 'weekly';
    const installments = unit === 'weekly' ? durationMonths * 4 : durationMonths;
    const installmentAmount = loan.totalRepayable / installments;
    const startDate = new Date();
    const schedule = [];
    for (let i = 1; i <= installments; i++) {
      const dueDate = new Date(startDate);
      if (unit === 'weekly') dueDate.setDate(dueDate.getDate() + (i * 7));
      else dueDate.setMonth(dueDate.getMonth() + i);
      schedule.push({
        loanId: loan._id,
        installmentNumber: i,
        dueDate,
        amountDue: Math.round(installmentAmount * 100) / 100,
        status: 'pending'
      });
    }
    await Repayment.insertMany(schedule);

    res.status(201).json({ success: true, loan, scheduleCount: schedule.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL LOANS ====================
exports.getAllLoans = async (req, res) => {
  try {
    const loans = await Loan.find().populate('memberId').sort('-createdAt');

    const withRepayments = await Promise.all(loans.map(async (loan) => {
      const Repayment = require('../models/Repayment');
      const repayments = await Repayment.find({ loanId: loan._id }).sort('installmentNumber');

      const paidAmount = repayments
        .filter(r => r.status === 'paid')
        .reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);

      const outstandingBalance = repayments
        .filter(r => r.status !== 'paid')
        .reduce((s, r) => s + Number(r.amountDue || 0), 0);

      return {
        ...loan.toObject(),
        repayments,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstandingBalance: Math.round(outstandingBalance * 100) / 100,
        totalInstallments: repayments.length,
        paidInstallments: repayments.filter(r => r.status === 'paid').length
      };
    }));

    res.json(withRepayments);
  } catch (err) {
    console.error('getAllLoans error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ==================== UPDATE STATUS ====================
exports.updateLoanStatus = async (req, res) => {
  try {
    const { status, reason, processingFeePercent } = req.body;
    const loan = await Loan.findById(req.params.id).populate('memberId');
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const previousStatus = loan.status;

    if (status === 'rejected') {
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }
      loan.rejectionReason = String(reason).trim();
    }

    if (status === 'approved' && processingFeePercent !== undefined && processingFeePercent !== null && processingFeePercent !== '') {
      const pct = Number(processingFeePercent) || 0;
      loan.processingFeePercent = pct;
      loan.processingFee = Math.round(Number(loan.amount) * (pct / 100) * 100) / 100;
    }

    loan.status = status;
    if (status === 'approved') loan.approvedDate = new Date();
    if (status === 'disbursed') loan.disbursedDate = new Date();
    if (status === 'active') loan.activeDate = new Date();
    if (status === 'closed') loan.closedDate = new Date();
    await loan.save();

    if (status === 'disbursed' && previousStatus !== 'disbursed' && loan.memberId) {
      const member = await Member.findById(loan.memberId._id);
      if (member) {
        member.lockedSavings = Number(member.savings) || 0;
        member.activeLoanId = loan._id;
        await member.save();
      }

      const fee = Number(loan.processingFee) || 0;
      const netDisbursed = Math.max(0, Number(loan.amount) - fee);
      loan.netDisbursed = netDisbursed;
      await loan.save();

      const loanAcc = await Account.findOne({ code: '1100' });
      if (loanAcc) {
        loanAcc.balance = (Number(loanAcc.balance) || 0) - netDisbursed;
        await loanAcc.save();
      }

      if (fee > 0) {
        const interestAcc = await Account.findOne({ code: '1300' });
        if (interestAcc) {
          interestAcc.balance = (Number(interestAcc.balance) || 0) + fee;
          await interestAcc.save();
        }
      }

      try {
        const lines = [
          { accountCode: '1150', debit: Number(loan.amount) },
          { accountCode: '1100', credit: netDisbursed }
        ];
        if (fee > 0) lines.push({ accountCode: '1300', credit: fee });

        await createJournalEntry({
          date: new Date(),
          description: `Loan disbursed to ${loan.memberId.firstName} ${loan.memberId.surname} (fee UGX ${fmt(fee)})`,
          reference: loan._id.toString(),
          sourceType: 'loan',
          lines
        });
      } catch (e) { console.error('Disburse journal:', e.message); }
    }

    if (status === 'closed' && previousStatus !== 'closed' && loan.memberId) {
      const member = await Member.findById(loan.memberId._id);
      if (member) {
        member.lockedSavings = 0;
        member.activeLoanId = null;
        await member.save();
      }
    }

    res.json({ success: true, loan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== FUND LOAN CARD ====================
exports.fundLoanCard = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const fundAmount = Number(amount);
    if (!fundAmount || fundAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const recent = await BusinessTransaction.findOne({
      type: 'capital_in', amount: fundAmount,
      date: { $gte: new Date(Date.now() - 5000) }
    });
    if (recent) return res.status(400).json({ error: 'Duplicate request detected. Please wait 5 seconds and try again.' });

    const clubAcc = await Account.findOne({ code: '1000' });
    if (!clubAcc) return res.status(400).json({ error: 'Club Capital account not found' });

    const clubBalance = Number(clubAcc.balance) || 0;
    if (clubBalance < fundAmount) return res.status(400).json({ error: `Insufficient Club Capital. Available: UGX ${fmt(clubBalance)}` });

    clubAcc.balance = clubBalance - fundAmount;
    await clubAcc.save();

    const loanAcc = await Account.findOne({ code: '1100' });
    if (loanAcc) {
      loanAcc.balance = (Number(loanAcc.balance) || 0) + fundAmount;
      await loanAcc.save();
    }

    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });
    if (loanBiz) {
      await BusinessTransaction.create({
        businessId: loanBiz._id, type: 'capital_in', amount: fundAmount,
        description: description || 'Loan Fund from Club Capital',
        sourceType: 'club_capital', date: new Date()
      });
      loanBiz.currentBalance = (Number(loanBiz.currentBalance) || 0) + fundAmount;
      loanBiz.totalCapitalAllocated = (Number(loanBiz.totalCapitalAllocated) || 0) + fundAmount;
      await loanBiz.save();
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: description || `Loan Fund from Club Capital: ${fmt(fundAmount)}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1100', debit: fundAmount },
          { accountCode: '1000', credit: fundAmount }
        ]
      });
    } catch (e) { console.error('Journal:', e.message); }

    res.json({ success: true, message: `UGX ${fmt(fundAmount)} moved from Club Capital to Loan Fund`, clubCapitalBalance: clubAcc.balance, loanFundBalance: loanAcc ? loanAcc.balance : 0 });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== WITHDRAW TO CLUB ====================
exports.withdrawToClub = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const loanAcc = await Account.findOne({ code: '1100' });
    if (!loanAcc || Number(loanAcc.balance) < withdrawAmount) {
      return res.status(400).json({ error: `Insufficient Loan Fund. Available: UGX ${fmt(loanAcc?.balance || 0)}` });
    }

    loanAcc.balance = Number(loanAcc.balance) - withdrawAmount;
    await loanAcc.save();

    const clubAcc = await Account.findOne({ code: '1000' });
    if (clubAcc) {
      clubAcc.balance = (Number(clubAcc.balance) || 0) + withdrawAmount;
      await clubAcc.save();
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: description || `Withdraw from Loan Fund to Club Capital: ${fmt(withdrawAmount)}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1000', debit: withdrawAmount },
          { accountCode: '1100', credit: withdrawAmount }
        ]
      });
    } catch (e) { console.error('Journal:', e.message); }

    res.json({ success: true, message: `UGX ${fmt(withdrawAmount)} moved to Club Capital`, clubCapitalBalance: clubAcc?.balance || 0, loanFundBalance: loanAcc.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== FUND STATUS ====================
exports.getFundStatus = async (req, res) => {
  try {
    const loanAcc = await Account.findOne({ code: '1100' });
    const interestAcc = await Account.findOne({ code: '1300' });
    const balance = loanAcc?.balance || 0;
    const interestBalance = interestAcc?.balance || 0;
    const nextMilestone = 1000000;
    const untilNextMilestone = Math.max(0, nextMilestone - interestBalance);

    const activeLoans = await Loan.find({ status: { $in: ['disbursed', 'active'] } });
    const principalLent = activeLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);

    res.json({ balance, principalLent, interestCollected: interestBalance, interestBalance, nextMilestone, untilNextMilestone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER LOANS SUMMARY ====================
exports.getMemberLoansSummary = async (req, res) => {
  try {
    const members = await Member.find();
    const loans = await Loan.find();
    const summary = members.map(m => {
      const mloans = loans.filter(l => l.memberId && l.memberId.toString() === m._id.toString());
      return {
        memberId: m._id,
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.surname}`,
        totalLoans: mloans.length,
        totalAmount: mloans.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        totalRepayable: mloans.reduce((s, l) => s + (Number(l.totalRepayable) || 0), 0)
      };
    });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER LOAN STATEMENT PDF ====================
exports.memberLoanStatementPDF = async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const loans = await Loan.find({ memberId: member._id }).sort('-createdAt');
    const allRepayments = await Repayment.find({ loanId: { $in: loans.map(l => l._id) } }).sort('dueDate');
    const ClubProfile = require('../models/ClubProfile');
    let profile = await ClubProfile.findOne();
    if (!profile) profile = {};

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=loan-statement-${member.memberNumber}.pdf`);
    doc.pipe(res);

    const M = 50;
    const pageW = doc.page.width;
    const contentW = pageW - M * 2;

    const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
    const contactParts = [profile.location, profile.address, profile.contact, profile.email].filter(Boolean);
    const contactLine = contactParts.join('  •  ');

    // HEADER
    doc.rect(0, 0, pageW, 110).fill('#0f3460');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(15);
    doc.text(clubName, M, 24, { width: contentW - 200 });
    doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1');
    let hy = doc.y + 2;
    if (contactLine) { doc.text(contactLine, M, hy, { width: contentW - 200 }); hy = doc.y + 2; }
    doc.text(`Generated: ${new Date().toLocaleString()}`, M, hy, { width: contentW - 200 });
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(15);
    doc.text('MEMBER LOAN STATEMENT', pageW - M - 200, 30, { width: 200, align: 'right' });

    // INFO
    let y = 128;
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11);
    doc.text('Member:', M, y);
    doc.font('Helvetica').text(`${member.firstName || ''} ${member.surname || ''}`.trim(), M + 70, y);
    doc.font('Helvetica-Bold').text('Member No:', pageW - M - 250, y);
    doc.font('Helvetica').text(member.memberNumber || '—', pageW - M - 170, y);
    y += 18;
    doc.font('Helvetica-Bold').text('Phone:', M, y);
    doc.font('Helvetica').text(member.phone || member.contact || '—', M + 70, y);
    y += 18;
    doc.font('Helvetica-Bold').text('Date:', pageW - M - 250, y);
    doc.font('Helvetica').text(new Date().toLocaleDateString(), pageW - M - 170, y);
    y += 26;

    // SUMMARY
    const totalBorrowed = loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalRepayable = loans.reduce((s, l) => s + Number(l.totalRepayable || 0), 0);
    const totalPaid = allRepayments.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amountPaid || r.amountDue || 0), 0);
    const totalOutstanding = totalRepayable - totalPaid;

    doc.rect(M, y, contentW, 50).fill('#f1f5f9');
    doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL BORROWED', M + 10, y + 8);
    doc.text('TOTAL REPAYABLE', M + 130, y + 8);
    doc.text('TOTAL PAID', M + 250, y + 8);
    doc.text('OUTSTANDING', M + 370, y + 8);
    doc.text('LOANS', M + 490, y + 8);

    doc.fontSize(13).fillColor('#1e293b');
    doc.text(`UGX ${fmt(totalBorrowed)}`, M + 10, y + 24);
    doc.text(`UGX ${fmt(totalRepayable)}`, M + 130, y + 24);
    doc.fillColor('#15803d').text(`UGX ${fmt(totalPaid)}`, M + 250, y + 24);
    doc.fillColor('#dc2626').text(`UGX ${fmt(totalOutstanding)}`, M + 370, y + 24);
    doc.fillColor('#0f3460').text(`${loans.length}`, M + 490, y + 24);

    y += 70;

    // LOANS
    for (const loan of loans) {
      const repayments = allRepayments.filter(r => r.loanId.toString() === loan._id.toString());
      if (y > doc.page.height - 200) { doc.addPage(); y = 50; }

      doc.rect(M, y, contentW, 26).fill('#0f3460');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11);
      doc.text(`LOAN: ${String(loan.type || '').toUpperCase()}`, M + 10, y + 8);
      doc.font('Helvetica').fontSize(9);
      doc.text(`Status: ${loan.status || '—'}`, pageW - M - 200, y + 9, { width: 190, align: 'right' });
      y += 26;

      const cells = [
        ['Principal', `UGX ${fmt(loan.amount)}`],
        ['Interest Rate', `${loan.interestRate || 0}%`],
        ['Duration', `${loan.durationMonths || 0} months`],
        ['Total Repayable', `UGX ${fmt(loan.totalRepayable)}`],
        ['Disbursed', loan.disbursedDate ? new Date(loan.disbursedDate).toLocaleDateString() : '—'],
        ['Schedule', loan.scheduleUnit || '—']
      ];
      doc.rect(M, y, contentW, 46).fill('#f8fafc');
      cells.forEach(([label, value], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = M + 12 + col * (contentW / 3);
        const cy = y + 8 + row * 20;
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, cy);
        doc.fillColor('#1e293b').font('Helvetica').fontSize(9).text(value, x, cy + 9);
      });
      y += 56;

      doc.rect(M, y, contentW, 20).fill('#1e293b');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
      doc.text('#', M + 8, y + 6, { width: 25 });
      doc.text('DUE DATE', M + 40, y + 6, { width: 80 });
      doc.text('AMOUNT DUE', M + 130, y + 6, { width: 90, align: 'right' });
      doc.text('PAID', M + 230, y + 6, { width: 90, align: 'right' });
      doc.text('BALANCE', M + 330, y + 6, { width: 90, align: 'right' });
      doc.text('STATUS', M + 430, y + 6, { width: 80 });
      y += 20;

      let runBal = Number(loan.totalRepayable || 0);
      repayments.forEach((r, i) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
        if (i % 2 === 0) doc.rect(M, y, contentW, 18).fill('#f8fafc');
        doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
        const due = Number(r.amountDue || 0);
        const paid = Number(r.amountPaid || 0);
        runBal = Math.max(0, runBal - paid);

        doc.text(String(r.installmentNumber || i + 1), M + 8, y + 5, { width: 25 });
        doc.text(new Date(r.dueDate).toLocaleDateString(), M + 40, y + 5, { width: 80 });
        doc.text(fmt(due), M + 130, y + 5, { width: 90, align: 'right' });
        doc.fillColor(paid > 0 ? '#15803d' : '#94a3b8');
        doc.text(paid > 0 ? fmt(paid) : '—', M + 230, y + 5, { width: 90, align: 'right' });
        doc.fillColor('#1e293b').text(fmt(runBal), M + 330, y + 5, { width: 90, align: 'right' });
        doc.fillColor(r.status === 'paid' ? '#15803d' : r.status === 'overdue' ? '#dc2626' : '#b45309');
        doc.font('Helvetica-Bold').text(String(r.status || 'pending').toUpperCase(), M + 430, y + 5, { width: 80 });
        y += 18;
      });

      doc.rect(M, y, contentW, 20).fill('#e0f2fe');
      doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(8);
      const loanPaid = repayments.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amountPaid || 0), 0);
      doc.text('LOAN TOTALS', M + 8, y + 6);
      doc.text(`PAID: UGX ${fmt(loanPaid)}`, M + 200, y + 6, { width: 180, align: 'right' });
      doc.text(`BALANCE: UGX ${fmt(Math.max(0, Number(loan.totalRepayable) - loanPaid))}`, M + 380, y + 6, { width: 180, align: 'right' });
      y += 30;

      if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
    }

    // DYNAMIC SIGNATURES
    if (y > doc.page.height - 130) { doc.addPage(); y = 80; }
    y += 20;
    
    let signatories = requestedSigs.length > 0 ? requestedSigs : ['treasurer', 'president'];
    const numSigs = signatories.length;
    const spacing = 30;
    const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;
    const sigY = y;

    for (let i = 0; i < numSigs; i++) {
      const role = signatories[i];
      const x = M + i * (sigW + spacing);
      
      const leader = await Leader.findOne({ role, active: true });
      const sigBuffer = await getLeaderSignature(role);

      doc.moveTo(x, sigY).lineTo(x + sigW, sigY).strokeColor('#1e293b').lineWidth(0.8).stroke();
      
      if (sigBuffer) {
        try {
          doc.image(sigBuffer, x, sigY - 22, { fit: [sigW, 20], align: 'center', valign: 'bottom' });
        } catch (e) {}
      }

      doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(9);
      doc.text(role.replace(/_/g, ' ').toUpperCase(), x, sigY + 6, { width: sigW, align: 'center' });
      
      doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(10);
      doc.text(leader?.name || '__________________', x, sigY + 20, { width: sigW, align: 'center' });
      
      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      doc.text('Date: ____________', x, sigY + 36, { width: sigW, align: 'center' });
    }

    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94a3b8');
    doc.text('This is a computer-generated statement. Retain for your records.', M, doc.page.height - 30, { width: contentW, align: 'center' });

    doc.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    console.error('Loan statement PDF error:', error.message);
  }
};

// ==================== GENERAL LOAN STATEMENT PDF ====================
exports.generalLoanStatementPDF = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const loans = await Loan.find().populate('memberId', 'firstName surname memberNumber');
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=general-loan-statement.pdf');
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, 80).fill('#0f3460');
    doc.fillColor('#fff').fontSize(18).text('CRESTED SS INVESTMENT CLUB LTD', 50, 25);
    doc.fontSize(12).text('General Loan Statement', 50, 50);
    doc.fillColor('#000').moveDown(3);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Loans: ${loans.length}`);
    doc.moveDown();

    let y = doc.y;
    doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
    doc.fillColor('#fff').fontSize(10);
    doc.text('Member', 60, y + 5);
    doc.text('Type', 200, y + 5);
    doc.text('Amount', 300, y + 5);
    doc.text('Status', 400, y + 5);
    y += 22;

    let total = 0;
    doc.fillColor('#000');
    loans.forEach((l, i) => {
      if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 18).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);
      const mname = l.memberId ? `${l.memberId.firstName} ${l.memberId.surname}` : '—';
      doc.text(mname, 60, y, { width: 130 });
      doc.text(l.type, 200, y);
      doc.text(fmt(l.amount), 300, y);
      doc.text(l.status, 400, y);
      total += Number(l.amount) || 0;
      y += 20;
    });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Total: ${fmt(total)}`, { align: 'right' });
    
    doc.moveDown(2);
    let signatories = requestedSigs.length > 0 ? requestedSigs : ['treasurer', 'president'];
    const numSigs = signatories.length;
    const sigStartY = doc.y;
    const w = (doc.page.width - 100) / numSigs;

    for (let i = 0; i < numSigs; i++) {
      const role = signatories[i];
      const x = 50 + (i * w);
      
      const leader = await Leader.findOne({ role, active: true });
      const sigBuffer = await getLeaderSignature(role);

      doc.moveTo(x, sigStartY).lineTo(x + w - 30, sigStartY).stroke();
      
      if (sigBuffer) {
        try {
          doc.image(sigBuffer, x, sigStartY - 22, { fit: [w - 30, 20], align: 'center', valign: 'bottom' });
        } catch (e) {}
      }

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f3460');
      doc.text(role.replace(/_/g, ' ').toUpperCase(), x, sigStartY + 5, { width: w - 30, align: 'center' });
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(leader?.name || '__________________', x, sigStartY + 20, { width: w - 30, align: 'center' });
      
      doc.fontSize(8).font('Helvetica').fillColor('#64748b');
      doc.text('Date: ______________', x, sigStartY + 35, { width: w - 30, align: 'center' });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SCHEDULE JSON ====================
exports.getScheduleJSON = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('memberId', 'firstName surname');
    const repayments = await Repayment.find({ loanId: req.params.id }).sort('installmentNumber').lean();
    const clean = repayments.map(r => ({
      _id: r._id,
      installmentNumber: r.installmentNumber,
      dueDate: r.dueDate,
      amountDue: r.amountDue,
      amountPaid: r.amountPaid || 0,
      status: r.status || 'pending',
      paidDate: r.paidDate || null
    }));
    res.json({
      loan: loan ? {
        _id: loan._id, type: loan.type, amount: loan.amount,
        interestRate: loan.interestRate, totalRepayable: loan.totalRepayable,
        memberId: loan.memberId
      } : null,
      repayments: clean
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REPAYMENT SCHEDULE PDF ====================
exports.repaymentSchedulePDF = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('memberId', 'firstName surname memberNumber');
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    const repayments = await Repayment.find({ loanId: loan._id }).sort('installmentNumber');

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=schedule-${loan.memberId.memberNumber}.pdf`);
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, 90).fill('#0f3460');
    doc.fillColor('#fff').fontSize(20).text('CRESTED SS INVESTMENT CLUB LTD', 50, 25);
    doc.fontSize(12).text('Loan Repayment Schedule', 50, 55);
    doc.fillColor('#000').moveDown(3);

    doc.fontSize(11).fillColor('#000');
    doc.text(`Member: ${loan.memberId.firstName} ${loan.memberId.surname}`);
    doc.text(`Member No: ${loan.memberId.memberNumber}`);
    doc.text(`Loan Type: ${loan.type}`);
    doc.text(`Principal: UGX ${fmt(loan.amount)}`);
    doc.text(`Interest Rate: ${loan.interestRate}%`);
    doc.text(`Total Repayable: UGX ${fmt(loan.totalRepayable)}`);
    doc.text(`Schedule: ${loan.scheduleUnit}`);
    doc.text(`Status: ${loan.status}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    const startY = doc.y;
    doc.rect(50, startY, doc.page.width - 100, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(9);
    doc.text('#', 55, startY + 6, { width: 20 });
    doc.text('Due Date', 80, startY + 6, { width: 70 });
    doc.text('Payment', 160, startY + 6, { width: 70, align: 'right' });
    doc.text('Interest', 240, startY + 6, { width: 60, align: 'right' });
    doc.text('Principal', 310, startY + 6, { width: 70, align: 'right' });
    doc.text('Balance', 400, startY + 6, { width: 80, align: 'right' });
    doc.text('Status', 490, startY + 6, { width: 60 });

    let y = startY + 26;
    let runningBalance = Number(loan.totalRepayable) || 0;
    let totalPayment = 0, totalInterest = 0, totalPrincipal = 0;

    repayments.forEach((r, i) => {
      if (y > doc.page.height - 180) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 3, doc.page.width - 100, 20).fill('#f8fafc');
      doc.fillColor('#000').fontSize(9);

      const payment = Number(r.amountDue) || 0;
      const totalInstallments = repayments.length;
      const principalPart = (Number(loan.amount) || 0) / totalInstallments;
      const interestPart = payment - principalPart;
      runningBalance -= payment;
      if (runningBalance < 0) runningBalance = 0;

      doc.text(String(r.installmentNumber), 55, y, { width: 20 });
      doc.text(new Date(r.dueDate).toLocaleDateString(), 80, y, { width: 70 });
      doc.text(fmt(payment), 160, y, { width: 70, align: 'right' });
      doc.text(fmt(Math.max(0, interestPart)), 240, y, { width: 60, align: 'right' });
      doc.text(fmt(Math.max(0, principalPart)), 310, y, { width: 70, align: 'right' });
      doc.text(fmt(runningBalance), 400, y, { width: 80, align: 'right' });
      doc.text(r.status || 'pending', 490, y, { width: 60 });

      totalPayment += payment;
      totalInterest += Math.max(0, interestPart);
      totalPrincipal += Math.max(0, principalPart);
      y += 20;
    });

    doc.moveDown();
    const totalY = y + 5;
    doc.rect(50, totalY, doc.page.width - 100, 25).fill('#e0f2fe');
    doc.fillColor('#0369a1').fontSize(10).font('Helvetica-Bold');
    doc.text('TOTALS:', 55, totalY + 8);
    doc.text(fmt(totalPayment), 160, totalY + 8, { width: 70, align: 'right' });
    doc.text(fmt(totalInterest), 240, totalY + 8, { width: 60, align: 'right' });
    doc.text(fmt(totalPrincipal), 310, totalY + 8, { width: 70, align: 'right' });
    doc.font('Helvetica');

    // ==================== SIGNATURES ====================
    let signatories = requestedSigs.length > 0 ? requestedSigs : ['treasurer', 'president'];
    const numSigs = signatories.length;
    const spacing = 30;
    const sigW = (doc.page.width - 100 - (numSigs - 1) * spacing) / numSigs;
    
    let sigY = totalY + 60;
    if (sigY > doc.page.height - 80) { doc.addPage(); sigY = 50; }

    for (let i = 0; i < numSigs; i++) {
      const role = signatories[i];
      const x = 50 + i * (sigW + spacing);
      
      const leader = await Leader.findOne({ role, active: true });
      const sigBuffer = await getLeaderSignature(role);

      doc.moveTo(x, sigY).lineTo(x + sigW, sigY).strokeColor('#1e293b').lineWidth(0.8).stroke();
      
      if (sigBuffer) {
        try {
          doc.image(sigBuffer, x, sigY - 22, { fit: [sigW, 20], align: 'center', valign: 'bottom' });
        } catch (e) {}
      }

      doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(9);
      doc.text(role.replace(/_/g, ' ').toUpperCase(), x, sigY + 6, { width: sigW, align: 'center' });
      
      doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(10);
      doc.text(leader?.name || '__________________', x, sigY + 20, { width: sigW, align: 'center' });
      
      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      doc.text('Date: ____________', x, sigY + 36, { width: sigW, align: 'center' });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== FUND HISTORY ====================
exports.getFundHistory = async (req, res) => {
  try {
    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });
    if (!loanBiz) return res.json([]);
    const txns = await BusinessTransaction.find({
      businessId: loanBiz._id,
      type: { $in: ['capital_in', 'external_in', 'refund', 'capital_out'] }
    }).sort('-date').limit(200);
    res.json(txns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== FUND FROM EXTERNAL FUNDER ====================
exports.fundFromExternal = async (req, res) => {
  try {
    const { funderName, amount, description, date } = req.body;
    const fundAmount = Number(amount);
    if (!funderName || !funderName.trim()) return res.status(400).json({ error: 'Funder name is required' });
    if (!fundAmount || fundAmount <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

    const loanAcc = await Account.findOne({ code: '1100' });
    if (!loanAcc) return res.status(400).json({ error: 'Loan Fund account not found' });
    loanAcc.balance = (Number(loanAcc.balance) || 0) + fundAmount;
    await loanAcc.save();

    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });
    if (loanBiz) {
      await BusinessTransaction.create({
        businessId: loanBiz._id, type: 'external_in', amount: fundAmount,
        description: description || `Loan Fund from external funder: ${funderName}`,
        sourceType: 'external', funderName, date: date ? new Date(date) : new Date()
      });
      loanBiz.currentBalance = (Number(loanBiz.currentBalance) || 0) + fundAmount;
      await loanBiz.save();
    }

    let funderAcc = await Account.findOne({ name: `External Funder: ${funderName}`, type: 'Liability' });
    if (!funderAcc) {
      funderAcc = await Account.create({
        code: `2${Date.now().toString().slice(-4)}`,
        name: `External Funder: ${funderName}`,
        type: 'Liability', category: 'external_funder', balance: fundAmount
      });
    } else {
      funderAcc.balance = (Number(funderAcc.balance) || 0) + fundAmount;
      await funderAcc.save();
    }

    try {
      await createJournalEntry({
        date: date ? new Date(date) : new Date(),
        description: description || `Loan Fund from external funder: ${funderName}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1100', debit: fundAmount },
          { accountCode: funderAcc.code, credit: fundAmount }
        ]
      });
    } catch (e) { console.error('Journal:', e.message); }

    res.json({ success: true, message: `UGX ${fmt(fundAmount)} added to Loan Fund from ${funderName}`, funder: funderName, funderBalance: funderAcc.balance, loanFundBalance: loanAcc.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== EXTERNAL FUNDERS LIST ====================
exports.getExternalFunders = async (req, res) => {
  try {
    const funders = await Account.find({ type: 'Liability', category: 'external_funder' }).sort('-createdAt');
    const total = funders.reduce((s, f) => s + (Number(f.balance) || 0), 0);
    res.json({ funders, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REFUND LOAN FUND ====================
exports.refundLoanFund = async (req, res) => {
  try {
    const { txnId } = req.params;
    const txn = await BusinessTransaction.findById(txnId);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.refunded) return res.status(400).json({ error: 'This transaction has already been refunded' });
    if (!['capital_in', 'external_in'].includes(txn.type)) return res.status(400).json({ error: 'Only funding transactions can be refunded' });

    const refundAmount = Number(txn.amount) || 0;
    const loanAcc = await Account.findOne({ code: '1100' });
    if (!loanAcc || Number(loanAcc.balance) < refundAmount) {
      return res.status(400).json({ error: `Insufficient Loan Fund. Available: UGX ${fmt(loanAcc?.balance || 0)}` });
    }
    loanAcc.balance = Number(loanAcc.balance) - refundAmount;
    await loanAcc.save();

    if (txn.sourceType === 'club_capital' || txn.type === 'capital_in') {
      const clubAcc = await Account.findOne({ code: '1000' });
      if (clubAcc) {
        clubAcc.balance = (Number(clubAcc.balance) || 0) + refundAmount;
        await clubAcc.save();
      }
    } else if (txn.funderName) {
      const funderAcc = await Account.findOne({ name: `External Funder: ${txn.funderName}`, type: 'Liability' });
      if (funderAcc) {
        funderAcc.balance = Math.max(0, (Number(funderAcc.balance) || 0) - refundAmount);
        await funderAcc.save();
      }
    }

    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });
    if (loanBiz) {
      loanBiz.currentBalance = Math.max(0, (Number(loanBiz.currentBalance) || 0) - refundAmount);
      await loanBiz.save();
    }

    txn.refunded = true;
    txn.refundedAt = new Date();
    await txn.save();

    await BusinessTransaction.create({
      businessId: txn.businessId, type: 'refund', amount: refundAmount,
      description: `Refund of: ${txn.description || 'Loan Fund'}`,
      reference: txn._id.toString(), sourceType: txn.sourceType,
      funderName: txn.funderName || '', originalTxnId: txn._id, date: new Date()
    });

    try {
      const lines = [{ accountCode: '1100', credit: refundAmount }];
      if (txn.sourceType === 'club_capital' || txn.type === 'capital_in') lines.push({ accountCode: '1000', debit: refundAmount });
      else if (txn.funderName) lines.push({ accountCode: '1000', debit: refundAmount });
      await createJournalEntry({
        date: new Date(),
        description: `Refund to ${txn.sourceType === 'external' ? (txn.funderName || 'External Funder') : 'Club Capital'}: ${fmt(refundAmount)}`,
        sourceType: 'loan', lines
      });
    } catch (e) { console.error('Journal:', e.message); }

    res.json({ success: true, message: `UGX ${fmt(refundAmount)} refunded to ${txn.sourceType === 'external' ? (txn.funderName || 'External Funder') : 'Club Capital'}`, loanFundBalance: loanAcc.balance });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== MARK PAID BY NUMBER ====================
exports.markPaidByNumber = async (req, res) => {
  try {
    const { loanId, installmentNumber } = req.params;
    const repayment = await Repayment.findOne({
      loanId,
      installmentNumber: parseInt(installmentNumber)
    });
    if (!repayment) return res.status(404).json({ error: 'Repayment not found' });
    if (repayment.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    repayment.status = 'paid';
    repayment.amountPaid = repayment.amountDue;
    repayment.paidDate = new Date();
    await repayment.save();

    const loan = await Loan.findById(repayment.loanId);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const totalInstallments = await Repayment.countDocuments({ loanId: loan._id });
    const principalPortion = Number(loan.amount) / totalInstallments;
    const interestPortion = Math.max(0, Number(repayment.amountDue) - principalPortion);

    const loanAcc = await Account.findOne({ code: '1100' });
    if (loanAcc) {
      loanAcc.balance = (Number(loanAcc.balance) || 0) + principalPortion;
      await loanAcc.save();
    }

    const interestAcc = await Account.findOne({ code: '1300' });
    if (interestAcc) {
      interestAcc.balance = (Number(interestAcc.balance) || 0) + interestPortion;
      await interestAcc.save();
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: `Loan repayment #${installmentNumber} — ${loan.type}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1100', debit: principalPortion },
          { accountCode: '1300', debit: interestPortion },
          { accountCode: '1150', credit: principalPortion },
          { accountCode: '3000', credit: interestPortion }
        ]
      });
    } catch (e) { console.error('Journal error:', e.message); }

    const paidCount = await Repayment.countDocuments({ loanId: loan._id, status: 'paid' });
    if (paidCount === 1 && loan.status === 'disbursed') {
      loan.status = 'active';
      loan.activeDate = new Date();
      await loan.save();
    }

    if (paidCount === totalInstallments) {
      loan.status = 'closed';
      loan.closedDate = new Date();
      await loan.save();

      if (loan.memberId) {
        const member = await Member.findById(loan.memberId);
        if (member) {
          member.lockedSavings = 0;
          member.activeLoanId = null;
          await member.save();
        }
      }
    }

    await checkInterestMilestone();

    const allReps = await Repayment.find({ loanId: loan._id });
    const remaining = allReps
      .filter(r => r.status !== 'paid')
      .reduce((s, r) => s + Number(r.amountDue || 0), 0);

    res.json({
      success: true,
      repayment,
      loanStatus: loan.status,
      principalReturned: principalPortion,
      interestEarned: interestPortion,
      remaining: Math.round(remaining * 100) / 100
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXTRACT INTEREST TO LOAN FUND ====================
exports.extractToLoanFund = async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const interestAcc = await Account.findOne({ code: '1300' });
    if (!interestAcc || Number(interestAcc.balance) < amt) {
      return res.status(400).json({ error: `Insufficient Interest Fund. Available: ${fmt(interestAcc?.balance || 0)}` });
    }
    interestAcc.balance = Number(interestAcc.balance) - amt;
    await interestAcc.save();

    const loanAcc = await Account.findOne({ code: '1100' });
    if (loanAcc) {
      loanAcc.balance = (Number(loanAcc.balance) || 0) + amt;
      await loanAcc.save();
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: `Extract from Interest Fund to Loan Fund: ${fmt(amt)}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1100', debit: amt },
          { accountCode: '1300', credit: amt }
        ]
      });
    } catch (e) { console.error('Journal:', e.message); }

    await checkInterestMilestone();

    res.json({ success: true, message: `${fmt(amt)} moved to Loan Fund`, interestBalance: interestAcc.balance, loanFundBalance: loanAcc?.balance || 0 });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== EXTRACT INTEREST TO CLUB CAPITAL ====================
exports.extractToClubCapital = async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const interestAcc = await Account.findOne({ code: '1300' });
    if (!interestAcc || Number(interestAcc.balance) < amt) {
      return res.status(400).json({ error: `Insufficient Interest Fund. Available: ${fmt(interestAcc?.balance || 0)}` });
    }
    interestAcc.balance = Number(interestAcc.balance) - amt;
    await interestAcc.save();

    const clubAcc = await Account.findOne({ code: '1000' });
    if (clubAcc) {
      clubAcc.balance = (Number(clubAcc.balance) || 0) + amt;
      await clubAcc.save();
    }

    try {
      await createJournalEntry({
        date: new Date(),
        description: `Extract from Interest Fund to Club Capital: ${fmt(amt)}`,
        sourceType: 'loan',
        lines: [
          { accountCode: '1000', debit: amt },
          { accountCode: '1300', credit: amt }
        ]
      });
    } catch (e) { console.error('Journal:', e.message); }

    await checkInterestMilestone();

    res.json({ success: true, message: `${fmt(amt)} moved to Club Capital`, interestBalance: interestAcc.balance, clubCapitalBalance: clubAcc?.balance || 0 });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RECORD REPAYMENT (legacy) ====================
exports.recordRepayment = async (req, res) => {
  try {
    const repayment = await Repayment.findById(req.params.installmentId);
    if (!repayment) return res.status(404).json({ error: 'Repayment not found' });
    if (repayment.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    repayment.status = 'paid';
    repayment.amountPaid = repayment.amountDue;
    repayment.paidDate = new Date();
    await repayment.save();

    const loan = await Loan.findById(repayment.loanId);
    const paidCount = await Repayment.countDocuments({ loanId: loan._id, status: 'paid' });
    if (paidCount === 1 && loan.status === 'disbursed') {
      loan.status = 'active';
      loan.activeDate = new Date();
      await loan.save();
    }
    const all = await Repayment.find({ loanId: loan._id });
    if (all.every(r => r.status === 'paid')) {
      loan.status = 'closed';
      loan.closedDate = new Date();
      await loan.save();
    }

    res.json({ success: true, repayment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REVERSE LOAN ====================
exports.reverseLoan = async (req, res) => {
  try {
    const { targetStatus } = req.body;
    const loan = await Loan.findById(req.params.id).populate('memberId');
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const previousStatus = loan.status;
    if (previousStatus === 'closed') {
      return res.status(400).json({ error: 'Cannot reverse a closed loan' });
    }
    if (!targetStatus) {
      return res.status(400).json({ error: 'Target status is required' });
    }

    if (previousStatus === 'disbursed' && targetStatus !== 'disbursed') {
      const loanAcc = await Account.findOne({ code: '1100' });
      if (loanAcc) {
        loanAcc.balance = (Number(loanAcc.balance) || 0) + Number(loan.amount);
        await loanAcc.save();
      }
    }

    if (previousStatus === 'active') {
      await Repayment.updateMany(
        { loanId: loan._id },
        { $set: { status: 'pending', amountPaid: 0, paidDate: null } }
      );
    }

    if (loan.memberId) {
      const member = await Member.findById(loan.memberId._id);
      if (member) {
        if (targetStatus === 'pending' || targetStatus === 'approved' || targetStatus === 'rejected') {
          member.lockedSavings = 0;
          member.activeLoanId = null;
          await member.save();
        }
      }
    }

    loan.status = targetStatus;
    if (targetStatus === 'pending') loan.approvedDate = undefined;
    if (targetStatus === 'pending' || targetStatus === 'approved') loan.disbursedDate = undefined;
    if (targetStatus !== 'active') loan.activeDate = undefined;
    await loan.save();

    res.json({
      success: true,
      message: `Loan reversed to ${targetStatus}`,
      loan
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE LOAN (with reversal) ====================
exports.deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('memberId');
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    if (['disbursed', 'active', 'closed'].includes(loan.status)) {
      const loanAcc = await Account.findOne({ code: '1100' });
      if (loanAcc) {
        loanAcc.balance = Math.max(0, (Number(loanAcc.balance) || 0) - Number(loan.amount));
        await loanAcc.save();
      }
    }

    const paidReps = await Repayment.find({ loanId: loan._id, status: 'paid' });
    const totalInstallments = await Repayment.countDocuments({ loanId: loan._id });
    const principalPerInstallment = totalInstallments > 0 ? Number(loan.amount) / totalInstallments : 0;
    const interestPaid = paidReps.reduce(
      (sum, r) => sum + Math.max(0, Number(r.amountDue) - principalPerInstallment),
      0
    );
    if (interestPaid > 0) {
      const interestAcc = await Account.findOne({ code: '1300' });
      if (interestAcc) {
        interestAcc.balance = Math.max(0, (Number(interestAcc.balance) || 0) - interestPaid);
        await interestAcc.save();
      }
    }

    if (loan.memberId) {
      const member = await Member.findById(loan.memberId._id);
      if (member) {
        member.lockedSavings = 0;
        member.activeLoanId = null;
        await member.save();
      }
    }

    await Repayment.deleteMany({ loanId: loan._id });
    await Loan.findByIdAndDelete(loan._id);

    res.json({
      success: true,
      message: `Loan and ${paidReps.length} paid installments deleted; accounts reversed`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== CHECK OVERDUE + APPLY PENALTIES ====================
exports.checkOverdue = async (req, res) => {
  try {
    const today = new Date();
    const Setting = require('../models/Setting');
    const Saving = require('../models/Saving');
    const settings = await Setting.findOne() || {};
    const penaltyRate = settings.latePaymentPenalty || 5;

    const overdue = await Repayment.find({
      status: 'pending',
      dueDate: { $lt: today }
    }).populate('loanId');

    let markedOverdue = 0;
    let penaltiesApplied = 0;

    for (const rep of overdue) {
      if (!rep.loanId) continue;

      rep.status = 'overdue';
      await rep.save();
      markedOverdue++;

      const penaltyAmount = Math.round(Number(rep.amountDue) * (penaltyRate / 100) * 100) / 100;

      const penalty = new Saving({
        memberId: rep.loanId.memberId,
        category: 'penalty',
        amount: penaltyAmount,
        description: `Late payment penalty — Loan ${rep.loanId._id} installment #${rep.installmentNumber}`,
        date: today
      });
      await penalty.save();
      penaltiesApplied++;
    }

    res.json({
      success: true,
      markedOverdue,
      penaltiesApplied,
      message: `${markedOverdue} installments marked overdue. ${penaltiesApplied} penalties applied.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== INTEREST EARNED ====================
exports.getInterestEarned = async (req, res) => {
  try {
    const loans = await Loan.find();
    const allReps = await Repayment.find({ status: 'paid' });

    let totalInterest = 0;
    let totalPrincipal = 0;

    for (const loan of loans) {
      const loanReps = allReps.filter(r => r.loanId.toString() === loan._id.toString());
      const totalInstallments = await Repayment.countDocuments({ loanId: loan._id });

      for (const rep of loanReps) {
        const principalPortion = Number(loan.amount) / (totalInstallments || 1);
        const interestPortion = Math.max(0, Number(rep.amountDue) - principalPortion);
        totalPrincipal += principalPortion;
        totalInterest += interestPortion;
      }
    }

    res.json({
      totalInterestEarned: Math.round(totalInterest * 100) / 100,
      totalPrincipalReturned: Math.round(totalPrincipal * 100) / 100,
      totalPaidInstallments: allReps.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PENDING COUNT ====================
exports.getPendingCount = async (req, res) => {
  try {
    const count = await Loan.countDocuments({ status: 'pending' });
    res.json({ pending: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== APPLY LATE PENALTY ====================
exports.applyLatePenalty = async (req, res) => {
  try {
    const { loanId, installmentNumber } = req.params;
    const Saving = require('../models/Saving');
    const Setting = require('../models/Setting');

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const repayment = await Repayment.findOne({
      loanId,
      installmentNumber: parseInt(installmentNumber)
    });
    if (!repayment) return res.status(404).json({ error: 'Installment not found' });
    if (repayment.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const settings = await Setting.findOne() || {};
    const rate = settings.latePaymentPenalty || 5;
    const penaltyAmount = Math.round(Number(repayment.amountDue) * (rate / 100) * 100) / 100;

    const penalty = new Saving({
      memberId: loan.memberId,
      category: 'penalty',
      amount: penaltyAmount,
      description: `Late payment penalty — Installment #${installmentNumber}`,
      date: new Date()
    });
    await penalty.save();

    const Account = require('../models/Account');
    const clubAcc = await Account.findOne({ code: '1000' });
    if (clubAcc) {
      clubAcc.balance = (Number(clubAcc.balance) || 0) + penaltyAmount;
      await clubAcc.save();
    }

    res.json({
      success: true,
      penaltyAmount,
      rate,
      message: `Penalty of UGX ${penaltyAmount.toLocaleString()} applied.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET OVERDUE COUNT ====================
exports.getOverdueCount = async (req, res) => {
  try {
    const today = new Date();
    const count = await Repayment.countDocuments({
      status: 'pending',
      dueDate: { $lt: today }
    });
    res.json({ overdue: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ALL LOAN SCHEDULES REPORT PDF ====================
exports.allSchedulesPDF = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const requestedSigs = req.query.signatories ? req.query.signatories.split(',') : [];
    const { status: statusFilter } = req.query;

    const query = {};
    if (statusFilter && statusFilter !== 'all') query.status = statusFilter;

    const loans = await Loan.find(query)
      .populate('memberId', 'firstName surname memberNumber')
      .sort('status -createdAt');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=all-loan-schedules.pdf');
    doc.pipe(res);

    const M = 50;
    const pageW = doc.page.width;
    const contentW = pageW - M * 2;

    doc.rect(0, 0, pageW, 90).fill('#0f3460');
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold');
    doc.text('CRESTED SS INVESTMENT CLUB LTD', M, 25, { width: contentW });
    doc.fontSize(12).font('Helvetica');
    doc.text('All Loan Schedules Report', M, 55);
    doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, M, 70);

    let y = 110;
    doc.fillColor('#1e293b').fontSize(10).font('Helvetica');
    doc.text(`Total Loans: ${loans.length}`, M, y);
    if (statusFilter && statusFilter !== 'all') {
      doc.text(` | Filtered: ${statusFilter}`, M + 120, y);
    }
    y += 20;

    const active = loans.filter(l => l.status === 'active');
    const overdue = loans.filter(l => l.status === 'disbursed');
    const closed = loans.filter(l => l.status === 'closed');
    const totalPrincipal = loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalRepayable = loans.reduce((s, l) => s + Number(l.totalRepayable || 0), 0);

    doc.rect(M, y, contentW, 50).fill('#f1f5f9');

    doc.fillColor('#0369a1').fontSize(9).font('Helvetica-Bold');
    doc.text('ACTIVE', M + 10, y + 8);
    doc.fontSize(14).text(String(active.length), M + 10, y + 22);

    doc.fillColor('#b45309').fontSize(9).font('Helvetica-Bold');
    doc.text('DISBURSED', M + 100, y + 8);
    doc.fontSize(14).text(String(overdue.length), M + 100, y + 22);

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
    doc.text('CLOSED', M + 200, y + 8);
    doc.fontSize(14).text(String(closed.length), M + 200, y + 22);

    doc.fillColor('#7c3aed').fontSize(9).font('Helvetica-Bold');
    doc.text('TOTAL PRINCIPAL', M + 290, y + 8);
    doc.fontSize(12).text(`UGX ${totalPrincipal.toLocaleString()}`, M + 290, y + 22);

    doc.fillColor('#15803d').fontSize(9).font('Helvetica-Bold');
    doc.text('TOTAL REPAYABLE', M + 430, y + 8);
    doc.fontSize(12).text(`UGX ${totalRepayable.toLocaleString()}`, M + 430, y + 22);

    y += 65;

    doc.rect(M, y, contentW, 22).fill('#0f3460');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    doc.text('Member', M + 5, y + 6, { width: 110 });
    doc.text('Type', M + 120, y + 6, { width: 60 });
    doc.text('Amount', M + 185, y + 6, { width: 70, align: 'right' });
    doc.text('Repayable', M + 260, y + 6, { width: 70, align: 'right' });
    doc.text('Paid', M + 335, y + 6, { width: 65, align: 'right' });
    doc.text('Outstanding', M + 405, y + 6, { width: 70, align: 'right' });
    doc.text('Status', M + 480, y + 6, { width: 65 });
    y += 22;

    let rowIdx = 0;
    for (const loan of loans) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
        doc.rect(M, y, contentW, 22).fill('#0f3460');
        doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
        doc.text('Member', M + 5, y + 6, { width: 110 });
        doc.text('Type', M + 120, y + 6, { width: 60 });
        doc.text('Amount', M + 185, y + 6, { width: 70, align: 'right' });
        doc.text('Repayable', M + 260, y + 6, { width: 70, align: 'right' });
        doc.text('Paid', M + 335, y + 6, { width: 65, align: 'right' });
        doc.text('Outstanding', M + 405, y + 6, { width: 70, align: 'right' });
        doc.text('Status', M + 480, y + 6, { width: 65 });
        y += 22;
        rowIdx = 0;
      }

      if (rowIdx % 2 === 0) doc.rect(M, y, contentW, 20).fill('#f8fafc');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');

      const memberName = loan.memberId
        ? `${loan.memberId.firstName || ''} ${loan.memberId.surname || ''}`.trim().slice(0, 20)
        : '—';
      const paid = Number(loan.totalRepayable || 0) - Number(loan.outstandingBalance || loan.totalRepayable || 0);

      doc.text(memberName, M + 5, y + 6, { width: 110 });
      doc.text(loan.type, M + 120, y + 6, { width: 60 });
      doc.text(Number(loan.amount || 0).toLocaleString(), M + 185, y + 6, { width: 70, align: 'right' });
      doc.text(Number(loan.totalRepayable || 0).toLocaleString(), M + 260, y + 6, { width: 70, align: 'right' });
      doc.text(paid.toLocaleString(), M + 335, y + 6, { width: 65, align: 'right' });

      const outstanding = Number(loan.outstandingBalance || loan.totalRepayable || 0);
      doc.fillColor(outstanding > 0 ? '#dc2626' : '#15803d').font('Helvetica-Bold');
      doc.text(outstanding.toLocaleString(), M + 405, y + 6, { width: 70, align: 'right' });

      doc.fillColor('#1e293b').font('Helvetica');
      doc.text(loan.status, M + 480, y + 6, { width: 65 });

      y += 20;
      rowIdx++;
    }

    if (y > doc.page.height - 120) { doc.addPage(); y = 60; } else { y += 20; }

    let signatories = requestedSigs.length > 0 ? requestedSigs : ['treasurer', 'president'];
    const numSigs = signatories.length;
    const spacing = 30;
    const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;

    for (let i = 0; i < numSigs; i++) {
      const role = signatories[i];
      const x = M + i * (sigW + spacing);
      
      const leader = await Leader.findOne({ role, active: true });
      const sigBuffer = await getLeaderSignature(role);

      doc.moveTo(x, y).lineTo(x + sigW, y).strokeColor('#1e293b').lineWidth(0.8).stroke();
      
      if (sigBuffer) {
        try {
          doc.image(sigBuffer, x, y - 22, { fit: [sigW, 20], align: 'center', valign: 'bottom' });
        } catch (e) {}
      }

      doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(9);
      doc.text(role.replace(/_/g, ' ').toUpperCase(), x, y + 6, { width: sigW, align: 'center' });
      
      doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(10);
      doc.text(leader?.name || '__________________', x, y + 20, { width: sigW, align: 'center' });
      
      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      doc.text('Date: ____________', x, y + 36, { width: sigW, align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('All schedules PDF error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== LOAN EXPENSES TOTAL ====================
exports.getLoanExpensesTotal = async (req, res) => {
  try {
    const Transaction = require('../models/BusinessTransaction');
    const loanBiz = await Business.findOne({ isSystem: true, type: 'loan' });

    if (!loanBiz) {
      return res.json({ total: 0, transactions: [] });
    }

    const txns = await BusinessTransaction.find({
      businessId: loanBiz._id,
      type: 'expense'
    }).sort('-date');

    const total = txns.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    res.json({ total, transactions: txns });
  } catch (error) {
    console.error('getLoanExpensesTotal error:', error.message);
    res.status(500).json({ error: error.message });
  }
};