const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const ClubExpense = require('../models/ClubExpense');

// ==================== TRIAL BALANCE (JSON) ====================
exports.getTrialBalance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const entries = await JournalEntry.find(filter);
    const accountTotals = {};
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (!accountTotals[line.accountCode]) {
          accountTotals[line.accountCode] = {
            code: line.accountCode, name: line.accountName, debit: 0, credit: 0
          };
        }
        accountTotals[line.accountCode].debit += line.debit || 0;
        accountTotals[line.accountCode].credit += line.credit || 0;
      }
    }

    const accounts = Object.values(accountTotals);
    let totalDebit = 0, totalCredit = 0;
    accounts.forEach(a => { totalDebit += a.debit; totalCredit += a.credit; });

    res.json({
      accounts,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PROFIT & LOSS (JSON) ====================
exports.getProfitAndLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const txns = await BusinessTransaction.find(filter);
    const businesses = await Business.find();

    const perBusiness = businesses.map(b => {
      const bTxns = txns.filter(t => t.businessId.toString() === b._id.toString());
      const revenue = bTxns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
      const expenses = bTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const losses = bTxns.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);
      return {
        businessId: b._id, businessName: b.name,
        revenue, expenses, losses,
        netProfit: revenue - expenses - losses
      };
    });

    const totalRevenue = perBusiness.reduce((s, b) => s + b.revenue, 0);
    const totalExpenses = perBusiness.reduce((s, b) => s + b.expenses, 0);
    const totalLosses = perBusiness.reduce((s, b) => s + b.losses, 0);

    const clubFilter = {};
    if (startDate || endDate) {
      clubFilter.date = {};
      if (startDate) clubFilter.date.$gte = new Date(startDate);
      if (endDate) clubFilter.date.$lte = new Date(endDate);
    }
    const clubExpenses = await ClubExpense.find(clubFilter);
    const totalClubExpenses = clubExpenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      businesses: perBusiness,
      totals: {
        totalRevenue, totalExpenses, totalLosses, totalClubExpenses,
        netProfit: totalRevenue - totalExpenses - totalLosses - totalClubExpenses
      },
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BALANCE SHEET (JSON) ====================
exports.getBalanceSheet = async (req, res) => {
  try {
    const accounts = await Account.find();

    const assets = accounts.filter(a => a.type === 'Asset');
    const liabilities = accounts.filter(a => a.type === 'Liability');
    const equity = accounts.filter(a => a.type === 'Equity');
    const revenue = accounts.filter(a => a.type === 'Revenue');
    const expenses = accounts.filter(a => a.type === 'Expense');

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const equityTotal = equity.reduce((s, a) => s + a.balance, 0);
    const revenueTotal = revenue.reduce((s, a) => s + a.balance, 0);
    const expenseTotal = expenses.reduce((s, a) => s + a.balance, 0);
    const equityAdjusted = -equityTotal + (-revenueTotal) - expenseTotal;

    res.json({
      assets: assets.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
      totalAssets,
      liabilities: liabilities.map(a => ({ code: a.code, name: a.name, balance: -a.balance })),
      totalLiabilities,
      equity: equity.map(a => ({ code: a.code, name: a.name, balance: -a.balance })),
      equityTotal: equityAdjusted,
      revenue: revenue.map(a => ({ code: a.code, name: a.name, balance: -a.balance })),
      revenueTotal: -revenueTotal,
      expenses: expenses.map(a => ({ code: a.code, name: a.name, balance: a.balance })),
      expenseTotal,
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== JOURNAL ENTRIES (JSON) ====================
exports.getJournalEntries = async (req, res) => {
  try {
    const { startDate, endDate, sourceType } = req.query;
    const filter = {};
    if (sourceType) filter.sourceType = sourceType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const entries = await JournalEntry.find(filter).sort('-date');
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const PDFDocument = require('pdfkit');
const { createHeader, tableHeader, tableRow, drawSignatures } = require('../utils/pdfHelper');

function setPdfHeaders(res, filename) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);
}
function extractSignatories(req) {
  return req.query.signatories ? req.query.signatories.split(',').filter(Boolean) : [];
}

// ═══════════════════════════════════════════════════════════
// TRIAL BALANCE PDF — with per-member sub-rows under Member Savings
// ═══════════════════════════════════════════════════════════
exports.trialBalancePDF = async (req, res) => {
  try {
    const requestedSigs = extractSignatories(req);

    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const entries = await JournalEntry.find(filter);
    const accountTotals = {};
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (!accountTotals[line.accountCode]) {
          accountTotals[line.accountCode] = {
            code: line.accountCode,
            name: line.accountName,
            debit: 0,
            credit: 0
          };
        }
        accountTotals[line.accountCode].debit += line.debit || 0;
        accountTotals[line.accountCode].credit += line.credit || 0;
      }
    }

    // Split member savings accounts (2005xxx) from everything else
    const memberAccounts = [];
    const regularAccounts = [];
    Object.values(accountTotals).forEach(acc => {
      if (/^2005\d{3}$/.test(acc.code)) memberAccounts.push(acc);
      else regularAccounts.push(acc);
    });

    memberAccounts.sort((a, b) => a.code.localeCompare(b.code));
    regularAccounts.sort((a, b) => a.code.localeCompare(b.code));

    const doc = new PDFDocument({ margin: 50 });
    setPdfHeaders(res, 'trial-balance');
    doc.pipe(res);

    const align = ['left', 'left', 'right', 'right'];
    const COLS = ['Code', 'Account', 'Debit (UGX)', 'Credit (UGX)'];
    const PAGE_BOTTOM = doc.page.height - 100;

    function checkPageBreak() {
      if (doc.y > PAGE_BOTTOM) {
        doc.addPage();
        createHeader(doc, 'Trial Balance (continued)', 'Account detail continued');
        tableHeader(doc, COLS, { align });
      }
    }

    createHeader(doc, 'Trial Balance', 'All account debits and credits');
    tableHeader(doc, COLS, { align });

    let td = 0, tc = 0;

    // ── Regular accounts ──
    regularAccounts.forEach((a, i) => {
      checkPageBreak();
      tableRow(doc, [
        a.code,
        a.name,
        a.debit ? a.debit.toLocaleString() : '—',
        a.credit ? a.credit.toLocaleString() : '—'
      ], { align, stripe: i % 2 === 1 });
      td += a.debit;
      tc += a.credit;
    });

    // ── Member Savings group ──
    if (memberAccounts.length > 0) {
      checkPageBreak();

      const memberDebit = memberAccounts.reduce((s, a) => s + a.debit, 0);
      const memberCredit = memberAccounts.reduce((s, a) => s + a.credit, 0);
      const netMemberBalance = memberCredit - memberDebit;

      // Parent row
      tableRow(doc, [
        '1010',
        `Member Savings (${memberAccounts.length} ledger account${memberAccounts.length === 1 ? '' : 's'})`,
        memberDebit ? memberDebit.toLocaleString() : '—',
        memberCredit.toLocaleString()
      ], { align, total: false });

      // Sub-rows per member
      memberAccounts.forEach((a, i) => {
        checkPageBreak();

        // Extract "Name (MemberNo)" from account name
        let displayName = a.name;
        if (displayName.includes('—')) {
          displayName = displayName.split('—').slice(1).join('—').trim();
        }

        // Extract member number in parens: "SAMUEL KABENGE (CRS2005/001)" → "CRS2005/001"
        const memberNoMatch = displayName.match(/\(([^)]+)\)/);
        const memberNo = memberNoMatch ? memberNoMatch[1] : a.code;

        // Display: "   Name — MemberNo"
        const rowLabel = `   ${displayName.replace(/\s*\([^)]+\)\s*$/, '')} — ${memberNo}`;

        tableRow(doc, [
          '',
          rowLabel,
          a.debit ? a.debit.toLocaleString() : '—',
          a.credit.toLocaleString()
        ], { align, stripe: i % 2 === 1 });
      });

      // Subtotal for member group
      checkPageBreak();
      tableRow(doc, [
        '',
        `   Subtotal — Member Savings`,
        memberDebit ? memberDebit.toLocaleString() : '—',
        memberCredit.toLocaleString()
      ], { align, total: true });

      td += memberDebit;
      tc += memberCredit;
    }

    // ── Grand Total ──
    checkPageBreak();
    tableRow(doc, ['', 'TOTAL', td.toLocaleString(), tc.toLocaleString()], { align, total: true });

    const balanced = Math.abs(td - tc) < 0.01;
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold')
      .fillColor(balanced ? '#15803d' : '#dc2626')
      .text(`Status: ${balanced ? '✓ BALANCED' : '⚠ NOT BALANCED'}`, 50, doc.y, {
        width: doc.page.width - 100, align: 'center'
      });

    await drawSignatures(doc, requestedSigs);
    doc.end();
  } catch (error) {
    console.error('trialBalancePDF:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== PROFIT & LOSS PDF ====================
exports.profitLossPDF = async (req, res) => {
  try {
    const requestedSigs = extractSignatories(req);

    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const txns = await BusinessTransaction.find(filter);
    const businesses = await Business.find();
    const clubExpenses = await ClubExpense.find(filter);
    const totalClubExpenses = clubExpenses.reduce((s, e) => s + e.amount, 0);

    const doc = new PDFDocument({ margin: 50 });
    setPdfHeaders(res, 'profit-loss');
    doc.pipe(res);

    createHeader(doc, 'Profit & Loss Statement', 'Revenue, expenses and net result by business');

    const align = ['left', 'right', 'right', 'right', 'right'];
    tableHeader(doc, [
      'Business', 'Revenue (UGX)', 'Expenses (UGX)', 'Losses (UGX)', 'Net Profit (UGX)'
    ], { align });

    let totalRev = 0, totalExp = 0, totalLoss = 0;
    businesses.forEach((b, i) => {
      const bTxns = txns.filter(t => t.businessId.toString() === b._id.toString());
      const revenue = bTxns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
      const expenses = bTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const losses = bTxns.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);
      const net = revenue - expenses - losses;

      tableRow(doc, [
        b.name,
        revenue.toLocaleString(),
        expenses.toLocaleString(),
        losses.toLocaleString(),
        net.toLocaleString()
      ], { align, stripe: i % 2 === 1 });

      totalRev += revenue;
      totalExp += expenses;
      totalLoss += losses;
    });

    tableRow(doc, [
      'TOTAL',
      totalRev.toLocaleString(),
      totalExp.toLocaleString(),
      totalLoss.toLocaleString(),
      (totalRev - totalExp - totalLoss).toLocaleString()
    ], { align, total: true });

    doc.moveDown(1.5);
    let y = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f3460');
    doc.text('Club Overhead', 50, y);
    y += 22;

    doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
    doc.text('Club Expenses', 55, y);
    doc.font('Helvetica-Bold').text(`UGX ${totalClubExpenses.toLocaleString()}`, 250, y, { width: 200, align: 'right' });
    y += 18;

    const finalNet = totalRev - totalExp - totalLoss - totalClubExpenses;
    doc.rect(50, y, doc.page.width - 100, 28).fill('#e0f2fe');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f3460');
    doc.text('NET PROFIT', 56, y + 9);
    doc.text(`UGX ${finalNet.toLocaleString()}`, 250, y + 9, { width: doc.page.width - 306, align: 'right' });

    await drawSignatures(doc, requestedSigs);
    doc.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== BALANCE SHEET PDF ====================
exports.balanceSheetPDF = async (req, res) => {
  try {
    const requestedSigs = extractSignatories(req);
    const accounts = await Account.find();

    const doc = new PDFDocument({ margin: 50 });
    setPdfHeaders(res, 'balance-sheet');
    doc.pipe(res);

    createHeader(doc, 'Balance Sheet', 'Snapshot of assets, liabilities and equity');

    const align = ['left', 'left', 'right'];
    const cols = ['Code', 'Account', 'Balance (UGX)'];

    const assets = accounts.filter(a => a.type === 'Asset');
    const liabilities = accounts.filter(a => a.type === 'Liability');
    const equity = accounts.filter(a => a.type === 'Equity');

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#15803d');
    doc.text('ASSETS', 50, doc.y);
    doc.moveDown(0.3);
    tableHeader(doc, cols, { align, fill: '#15803d' });
    let totalAssets = 0;
    assets.forEach((a, i) => {
      tableRow(doc, [a.code, a.name, a.balance.toLocaleString()], { align, stripe: i % 2 === 1 });
      totalAssets += a.balance;
    });
    tableRow(doc, ['', 'Total Assets', totalAssets.toLocaleString()], { align, total: true });

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#dc2626');
    doc.text('LIABILITIES', 50, doc.y);
    doc.moveDown(0.3);
    tableHeader(doc, cols, { align, fill: '#dc2626' });
    let totalLiab = 0;
    liabilities.forEach((a, i) => {
      tableRow(doc, [a.code, a.name, (-a.balance).toLocaleString()], { align, stripe: i % 2 === 1 });
      totalLiab += -a.balance;
    });
    tableRow(doc, ['', 'Total Liabilities', totalLiab.toLocaleString()], { align, total: true });

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#7c3aed');
    doc.text('EQUITY', 50, doc.y);
    doc.moveDown(0.3);
    tableHeader(doc, cols, { align, fill: '#7c3aed' });
    let totalEquity = 0;
    equity.forEach((a, i) => {
      tableRow(doc, [a.code, a.name, (-a.balance).toLocaleString()], { align, stripe: i % 2 === 1 });
      totalEquity += -a.balance;
    });
    tableRow(doc, ['', 'Total Equity', totalEquity.toLocaleString()], { align, total: true });

    await drawSignatures(doc, requestedSigs);
    doc.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== JOURNAL ENTRIES PDF ====================
exports.journalEntriesPDF = async (req, res) => {
  try {
    const requestedSigs = extractSignatories(req);

    const { startDate, endDate, sourceType } = req.query;
    const filter = {};
    if (sourceType) filter.sourceType = sourceType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const entries = await JournalEntry.find(filter).sort('-date');

    const doc = new PDFDocument({ margin: 50 });
    setPdfHeaders(res, 'journal-entries');
    doc.pipe(res);

    createHeader(doc, 'Journal Entries', `Total: ${entries.length} entries in period`);

    const align = ['left', 'right', 'right'];

    if (entries.length === 0) {
      doc.fontSize(10).fillColor('#64748b').text('No journal entries in the selected period.', 50, doc.y, {
        width: doc.page.width - 100, align: 'center'
      });
    } else {
      entries.forEach((entry) => {
        if (doc.y > doc.page.height - 200) doc.addPage();

        doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f3460');
        doc.text(entry.entryNumber, 50, doc.y);
        doc.font('Helvetica').fontSize(9).fillColor('#64748b');
        doc.text(new Date(entry.date).toLocaleDateString(), 50, doc.y - 13, {
          width: doc.page.width - 100, align: 'right'
        });
        doc.moveDown(0.3);

        if (entry.description) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b');
          doc.text(entry.description, 50, doc.y, { width: doc.page.width - 100 });
          doc.moveDown(0.3);
        }

        tableHeader(doc, ['Account', 'Debit (UGX)', 'Credit (UGX)'], { align });
        (entry.lines || []).forEach((line, i) => {
          tableRow(doc, [
            `${line.accountCode} - ${line.accountName}`,
            line.debit ? line.debit.toLocaleString() : '—',
            line.credit ? line.credit.toLocaleString() : '—'
          ], { align, stripe: i % 2 === 1 });
        });

        doc.moveDown(1);
      });
    }

    await drawSignatures(doc, requestedSigs);
    doc.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== BUSINESS TRANSACTIONS PDF ====================
exports.businessTransactionsPDF = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const transactions = await BusinessTransaction.find({ businessId: business._id }).sort('date');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${business.name}-transactions.pdf`);
    doc.pipe(res);

    createHeader(doc, `Transaction Report`, business.name);

    const align = ['left', 'left', 'right', 'left'];
    tableHeader(doc, ['Date', 'Type', 'Amount (UGX)', 'Description'], { align });

    transactions.forEach((t, i) => {
      tableRow(doc, [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.amount.toLocaleString(),
        t.description || '—'
      ], { align, stripe: i % 2 === 1 });
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};