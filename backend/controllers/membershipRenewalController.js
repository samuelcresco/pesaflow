const Member = require('../models/Member');
const Saving = require('../models/Saving');
const Account = require('../models/Account');
const Receipt = require('../models/Receipt');
const ClubSetting = require('../models/ClubSetting');
const MembershipCertificate = require('../models/MembershipCertificate');
const { issueCertificate } = require('./membershipCertificateController');
const { generateReceiptNumber } = require('../utils/receiptNumber');
const { createJournalEntry } = require('../utils/journalHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== FEE LOOKUP ====================
async function getFees(year) {
  const setting = await ClubSetting.findOne({ year });
  if (!setting) return { firstTimeFee: 0, renewalFee: 0 };
  return {
    firstTimeFee: Number(setting.membershipFee) || 0,
    renewalFee: Number(setting.membershipRenewalFee) || 0
  };
}

// Get the fee for a specific year — used for arrears (older years use that year's rate)
async function getFeeForYear(year) {
  const setting = await ClubSetting.findOne({ year });
  return {
    firstTime: Number(setting?.membershipFee) || 0,
    renewal: Number(setting?.membershipRenewalFee) || 0
  };
}

// ==================== COMPUTE ARREARS FOR A MEMBER ====================
// Returns array: [{ year, fee, status: 'paid'|'owed'|'waived', savingId }]
async function computeMemberYears(member, uptoYear) {
  const startYear = new Date(member.dateOfSubscription || member.createdAt || Date.now()).getFullYear();
  const waived = Array.isArray(member.membershipWaivedYears) ? member.membershipWaivedYears : [];
  const rows = [];

  // Find all membership savings for this member in one query
  const allSavings = await Saving.find({
    memberId: member._id,
    category: 'membership'
  }).lean();

  for (let y = startYear; y <= uptoYear; y++) {
    const yearStart = new Date(y, 0, 1);
    const yearEnd = new Date(y + 1, 0, 1);
    const saving = allSavings.find(s => {
      const d = new Date(s.date);
      return d >= yearStart && d < yearEnd;
    });

    const isWaived = waived.includes(y);

    // Fee: use year's fee; if not set, fall back to current year's
    const yearFees = await getFeeForYear(y);
    const currentFees = await getFees(uptoYear);
    const fee = (yearFees.renewal || yearFees.firstTime || currentFees.renewal || currentFees.firstTime) || 0;

    let status;
    if (saving) status = 'paid';
    else if (isWaived) status = 'waived';
    else status = 'owed';

    rows.push({
      year: y,
      fee,
      status,
      amountPaid: Number(saving?.amount) || 0,
      savingId: saving?._id || null
    });
  }

  return rows;
}
exports._computeMemberYears = computeMemberYears;

// ==================== STATS ====================
exports.getStats = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const fees = await getFees(year);

    const activeMembers = await Member.countDocuments({ active: true });
    const certificatesThisYear = await MembershipCertificate.countDocuments({ year, status: 'active' });
    const cancelledThisYear = await MembershipCertificate.countDocuments({ year, status: 'cancelled' });

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const savingsThisYear = await Saving.aggregate([
      { $match: { category: 'membership', date: { $gte: yearStart, $lt: yearEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalCollected = Number(savingsThisYear[0]?.total) || 0;

    // Total arrears = members owing any year before `year`
    const members = await Member.find({ active: true }).lean();
    let totalArrears = 0;
    let membersWithArrears = 0;
    for (const m of members) {
      const rows = await computeMemberYears(m, year - 1);
      const owed = rows.filter(r => r.status === 'owed');
      if (owed.length > 0) {
        membersWithArrears++;
        totalArrears += owed.reduce((s, r) => s + r.fee, 0);
      }
    }

    res.json({
      year,
      firstTimeFee: fees.firstTimeFee,
      renewalFee: fees.renewalFee,
      activeMembers,
      renewedCount: certificatesThisYear,
      cancelledThisYear,
      notYetRenewed: Math.max(0, activeMembers - certificatesThisYear),
      totalCollected,
      totalArrears,
      membersWithArrears
    });
  } catch (error) {
    console.error('getStats error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== PAID MEMBERS LIST ====================
// Returns every active member + their year-by-year status
exports.getMembersStatus = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const members = await Member.find({ active: true }).sort('memberNumber').lean();

    const rows = [];
    for (const m of members) {
      const yearRows = await computeMemberYears(m, year);

      // Certificate status per year
      const certs = await MembershipCertificate.find({ memberId: m._id }).lean();
      const certByYear = {};
      certs.forEach(c => { certByYear[c.year] = c; });

      const currentYearRow = yearRows.find(r => r.year === year);
      const arrears = yearRows.filter(r => r.year < year && r.status === 'owed');

      rows.push({
        memberId: m._id,
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.surname}`,
        contact: m.contact || '',
        savings: Number(m.savings) || 0,
        lockedSavings: Number(m.lockedSavings) || 0,
        availableSavings: Math.max(0, (Number(m.savings) || 0) - (Number(m.lockedSavings) || 0)),
        years: yearRows,
        currentYearStatus: currentYearRow?.status || 'owed',
        currentYearCertificate: certByYear[year] || null,
        arrearsYears: arrears.map(r => r.year),
        arrearsTotal: arrears.reduce((s, r) => s + r.fee, 0)
      });
    }

    res.json({ year, rows });
  } catch (error) {
    console.error('getMembersStatus error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MARK AS PAID (admin, manual) ====================
// Body: { memberId, years: [2024, 2025], paymentSource: 'cash'|'savings' }
// Deducts from savings if needed, records Saving + Receipt + Journal per year,
// and issues a certificate for each year.
exports.markAsPaid = async (req, res) => {
  try {
    const { memberId, years, paymentSource } = req.body;

    if (!memberId) return res.status(400).json({ error: 'memberId required' });
    if (!Array.isArray(years) || years.length === 0) return res.status(400).json({ error: 'years array required' });
    const source = paymentSource === 'savings' ? 'savings' : 'cash';

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const currentYear = new Date().getFullYear();
    const currentFees = await getFees(currentYear);

    // Load all years of this member up to current year to validate which are owed
    const allYears = await computeMemberYears(member, currentYear);

    const results = [];
    let totalDeductedFromSavings = 0;

    for (const y of years) {
      const yearNum = Number(y);
      const row = allYears.find(r => r.year === yearNum);
      if (!row) {
        results.push({ year: yearNum, status: 'skipped', reason: 'year out of range' });
        continue;
      }
      if (row.status === 'paid') {
        results.push({ year: yearNum, status: 'skipped', reason: 'already paid' });
        continue;
      }
      if (row.status === 'waived') {
        results.push({ year: yearNum, status: 'skipped', reason: 'waived' });
        continue;
      }

      const fee = row.fee || currentFees.renewalFee || currentFees.firstTimeFee;
      if (fee <= 0) {
        results.push({ year: yearNum, status: 'skipped', reason: 'no fee configured for that year' });
        continue;
      }

      // If paying from savings, check availability
      if (source === 'savings') {
        const available = Math.max(0, (Number(member.savings) || 0) - (Number(member.lockedSavings) || 0));
        if (available < fee) {
          results.push({ year: yearNum, status: 'failed', reason: `insufficient savings (need ${fmt(fee)}, have ${fmt(available)})` });
          continue;
        }
        member.savings = Number(member.savings) - fee;
        totalDeductedFromSavings += fee;
        await member.save();
      }

      // Save record
      let saving = null;
      try {
        saving = await Saving.create({
          memberId: member._id,
          category: 'membership',
          amount: fee,
          description: `${yearNum} membership ${row.year === new Date(member.dateOfSubscription || Date.now()).getFullYear() ? 'first-time' : 'renewal'} (marked by admin)`,
          membershipType: yearNum === new Date(member.dateOfSubscription || Date.now()).getFullYear() ? 'first_time' : 'renewal',
          date: new Date(yearNum, 5, 15) // mid-year date so it lands in the correct year
        });
      } catch (e) { console.error('markAsPaid Saving:', e.message); }

      // Bump Account 1020
      let membershipAcc = await Account.findOne({ code: '1020' });
      if (!membershipAcc) membershipAcc = await Account.create({ code: '1020', name: 'Membership Fees', type: 'Equity', balance: 0 });
      membershipAcc.balance = (Number(membershipAcc.balance) || 0) + fee;
      await membershipAcc.save();

      // Journal
      try {
        const lines = source === 'savings'
          ? [{ accountCode: '1010', debit: fee }, { accountCode: '1020', credit: fee }]
          : [{ accountCode: '1000', debit: fee }, { accountCode: '1020', credit: fee }];
        await createJournalEntry({
          date: new Date(),
          description: `${yearNum} membership ${source === 'savings' ? 'from savings' : 'cash'} — ${member.firstName} ${member.surname}`,
          sourceType: 'savings',
          lines
        });
      } catch (e) { console.error('markAsPaid journal:', e.message); }

      // Receipt
      let receipt = null;
      try {
        const receiptNumber = await generateReceiptNumber(new Date());
        receipt = await Receipt.create({
          receiptNumber,
          type: 'membership_fee',
          memberId: member._id,
          memberName: `${member.firstName} ${member.surname}`,
          memberNumber: member.memberNumber,
          amount: fee,
          description: `${yearNum} Membership (${source})`,
          category: 'membership',
          lineItems: [{
            label: `${yearNum} Membership`,
            category: 'membership',
            amount: fee,
            description: source === 'savings' ? 'Deducted from savings' : 'Paid in cash'
          }],
          date: new Date(),
          issuedBy: req.body.issuedBy || 'admin',
          issuedByName: 'Admin',
          status: 'issued'
        });
      } catch (e) { console.error('markAsPaid receipt:', e.message); }

      // Issue certificate
      let cert = null;
      try {
        cert = await issueCertificate({
          member,
          year: yearNum,
          feePaid: fee,
          membershipType: 'renewal',
          issuedBy: req.body.issuedBy || 'admin',
          paymentSource: source === 'savings' ? 'savings' : 'cash'
        });
      } catch (e) { console.error('markAsPaid cert:', e.message); }

      results.push({
        year: yearNum,
        status: 'paid',
        fee,
        receiptNumber: receipt?.receiptNumber || null,
        certificateNumber: cert?.certificateNumber || null
      });
    }

    res.json({
      success: true,
      memberId: member._id,
      memberName: `${member.firstName} ${member.surname}`,
      results,
      totalDeductedFromSavings
    });
  } catch (error) {
    console.error('markAsPaid error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== WAIVE A YEAR ====================
exports.waiveYear = async (req, res) => {
  try {
    const { memberId, year } = req.body;
    if (!memberId || !year) return res.status(400).json({ error: 'memberId and year required' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const y = Number(year);
    if (!member.membershipWaivedYears) member.membershipWaivedYears = [];
    if (!member.membershipWaivedYears.includes(y)) {
      member.membershipWaivedYears.push(y);
      await member.save();
    }

    res.json({ success: true, message: `Year ${y} waived for ${member.firstName} ${member.surname}`, waivedYears: member.membershipWaivedYears });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== UNWAIVE ====================
exports.unwaiveYear = async (req, res) => {
  try {
    const { memberId, year } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.membershipWaivedYears = (member.membershipWaivedYears || []).filter(y => Number(y) !== Number(year));
    await member.save();

    res.json({ success: true, message: `Year ${year} un-waived`, waivedYears: member.membershipWaivedYears });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DEBT LIST (arrears only) ====================
exports.getDebtList = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const members = await Member.find({ active: true }).sort('memberNumber').lean();

    const debtors = [];
    let grandTotal = 0;

    for (const m of members) {
      const rows = await computeMemberYears(m, year - 1);
      const owed = rows.filter(r => r.status === 'owed');
      if (owed.length === 0) continue;

      const owedTotal = owed.reduce((s, r) => s + r.fee, 0);
      grandTotal += owedTotal;

      debtors.push({
        memberId: m._id,
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.surname}`,
        contact: m.contact || '',
        savings: Number(m.savings) || 0,
        owedYears: owed.map(r => ({ year: r.year, fee: r.fee })),
        totalOwed: owedTotal
      });
    }

    res.json({ members: debtors, totalDebt: grandTotal, count: debtors.length, year });
  } catch (error) {
    console.error('getDebtList error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== RENEWAL PREVIEW (current year) ====================
exports.previewRenewal = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const fees = await getFees(year);

    if (fees.renewalFee <= 0) {
      return res.status(400).json({ error: `No renewal fee set for ${year}. Configure it in Savings → Savings Settings.` });
    }

    const members = await Member.find({ active: true }).sort('memberNumber').lean();
    const rows = [];
    let willRenew = 0, willOwe = 0, alreadyPaid = 0, totalToCollect = 0;

    for (const m of members) {
      const yearRows = await computeMemberYears(m, year);
      const current = yearRows.find(r => r.year === year);
      if (!current) continue;

      const available = Math.max(0, (Number(m.savings) || 0) - (Number(m.lockedSavings) || 0));

      let status, debt = 0;
      if (current.status === 'paid') {
        status = 'already_paid'; alreadyPaid++;
      } else if (current.status === 'waived') {
        status = 'waived';
      } else if (available >= fees.renewalFee) {
        status = 'will_renew'; willRenew++; totalToCollect += fees.renewalFee;
      } else {
        status = 'will_owe'; willOwe++;
        debt = fees.renewalFee - available;
        totalToCollect += available;
      }

      rows.push({
        memberId: m._id,
        memberNumber: m.memberNumber,
        name: `${m.firstName} ${m.surname}`,
        savings: Number(m.savings) || 0,
        availableSavings: available,
        fee: fees.renewalFee,
        status,
        debtAmount: debt
      });
    }

    res.json({
      year,
      fee: fees.renewalFee,
      summary: {
        totalActiveMembers: members.length,
        willRenew,
        willOwe,
        alreadyPaid,
        totalToCollect
      },
      rows
    });
  } catch (error) {
    console.error('previewRenewal error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXECUTE RENEWAL (current year) ====================
exports.executeRenewal = async (req, res) => {
  try {
    const year = Number(req.body.year) || new Date().getFullYear();
    const fees = await getFees(year);

    if (fees.renewalFee <= 0) return res.status(400).json({ error: `No renewal fee set for ${year}.` });

    const members = await Member.find({ active: true }).sort('memberNumber');

    let renewed = 0, owed = 0, skipped = 0, totalCollected = 0;

    let membershipAcc = await Account.findOne({ code: '1020' });
    if (!membershipAcc) membershipAcc = await Account.create({ code: '1020', name: 'Membership Fees', type: 'Equity', balance: 0 });

    for (const m of members) {
      const yearRows = await computeMemberYears(m, year);
      const current = yearRows.find(r => r.year === year);
      if (!current) continue;

      if (current.status === 'paid' || current.status === 'waived') {
        skipped++;
        continue;
      }

      const available = Math.max(0, (Number(m.savings) || 0) - (Number(m.lockedSavings) || 0));

      if (available >= fees.renewalFee) {
        m.savings = Number(m.savings) - fees.renewalFee;
        m.membershipPaidYear = year;
        await m.save();

        try {
          await Saving.create({
            memberId: m._id,
            category: 'membership',
            amount: fees.renewalFee,
            description: `${year} annual renewal (auto-deducted)`,
            membershipType: 'renewal',
            date: new Date()
          });
        } catch (e) { console.error('Renewal Saving:', e.message); }

        membershipAcc.balance = (Number(membershipAcc.balance) || 0) + fees.renewalFee;
        await membershipAcc.save();

        try {
          await createJournalEntry({
            date: new Date(),
            description: `${year} membership renewal — ${m.firstName} ${m.surname}`,
            sourceType: 'savings',
            lines: [
              { accountCode: '1010', debit: fees.renewalFee },
              { accountCode: '1020', credit: fees.renewalFee }
            ]
          });
        } catch (e) { console.error('Renewal journal:', e.message); }

        try {
          const receiptNumber = await generateReceiptNumber(new Date());
          await Receipt.create({
            receiptNumber,
            type: 'membership_fee',
            memberId: m._id,
            memberName: `${m.firstName} ${m.surname}`,
            memberNumber: m.memberNumber,
            amount: fees.renewalFee,
            description: `${year} Membership Renewal`,
            category: 'membership',
            lineItems: [{
              label: `${year} Renewal`,
              category: 'membership',
              amount: fees.renewalFee,
              description: 'Auto-deducted from savings'
            }],
            date: new Date(),
            issuedBy: 'system',
            issuedByName: 'Renewal Engine',
            status: 'issued'
          });
        } catch (e) { console.error('Renewal receipt:', e.message); }

        try {
          await issueCertificate({
            member: m,
            year,
            feePaid: fees.renewalFee,
            membershipType: 'renewal',
            issuedBy: 'system',
            paymentSource: 'savings'
          });
        } catch (e) { console.error('Renewal cert:', e.message); }

        totalCollected += fees.renewalFee;
        renewed++;

      } else {
        // Member goes into "arrears" — no money deducted, nothing issued
        owed++;
      }
    }

    res.json({ success: true, year, fee: fees.renewalFee, summary: { renewed, owed, skipped, totalCollected } });
  } catch (error) {
    console.error('executeRenewal error:', error.message);
    res.status(400).json({ error: error.message });
  }
};