const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const ClubExpense = require('../models/ClubExpense');

// ==================== TRIAL BALANCE ====================
exports.getTrialBalance = async (req, res) => {
  try {
    const { month, year, startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const entries = await JournalEntry.find(filter);

    // Sum debits and credits per account
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

    const accounts = Object.values(accountTotals);
    let totalDebit = 0;
    let totalCredit = 0;
    accounts.forEach(a => {
      totalDebit += a.debit;
      totalCredit += a.credit;
    });

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

// ==================== PROFIT & LOSS ====================
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

    // Group by business
    const businesses = await Business.find();
    const perBusiness = businesses.map(b => {
      const bTxns = txns.filter(t => t.businessId.toString() === b._id.toString());
      const revenue = bTxns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
      const expenses = bTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const losses = bTxns.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);

      return {
        businessId: b._id,
        businessName: b.name,
        revenue,
        expenses,
        losses,
        netProfit: revenue - expenses - losses
      };
    });

    const totalRevenue = perBusiness.reduce((s, b) => s + b.revenue, 0);
    const totalExpenses = perBusiness.reduce((s, b) => s + b.expenses, 0);
    const totalLosses = perBusiness.reduce((s, b) => s + b.losses, 0);

    // Club expenses
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
        totalRevenue,
        totalExpenses,
        totalLosses,
        totalClubExpenses,
        netProfit: totalRevenue - totalExpenses - totalLosses - totalClubExpenses
      },
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BALANCE SHEET ====================
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

    // Equity balance = Equity accounts + (Revenue - Expenses)
    const equityTotal = equity.reduce((s, a) => s + a.balance, 0);
    const revenueTotal = revenue.reduce((s, a) => s + a.balance, 0);
    const expenseTotal = expenses.reduce((s, a) => s + a.balance, 0);

    // Note: account balance is debit - credit. Equity credits show as negative.
    // Adjust sign for presentation
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

// ==================== JOURNAL ENTRIES LIST ====================
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
const { createHeader, tableHeader, tableRow } = require('../utils/pdfHelper');

// ==================== TRIAL BALANCE PDF ====================
exports.trialBalancePDF = async (req, res) => {
  try {
    const entries = await JournalEntry.find();
    const accountTotals = {};
    for (const entry of entries) {
      for (const line of entry.lines) {
        if (!accountTotals[line.accountCode]) {
          accountTotals[line.accountCode] = { code: line.accountCode, name: line.accountName, debit: 0, credit: 0 };
        }
        accountTotals[line.accountCode].debit += line.debit || 0;
        accountTotals[line.accountCode].credit += line.credit || 0;
      }
    }
    const accounts = Object.values(accountTotals);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=trial-balance.pdf');
    doc.pipe(res);

    createHeader(doc, 'Trial Balance');
    tableHeader(doc, ['Code', 'Account', 'Debit', 'Credit']);

    let td = 0, tc = 0;
    accounts.forEach(a => {
      tableRow(doc, [a.code, a.name, a.debit.toLocaleString(), a.credit.toLocaleString()]);
      td += a.debit;
      tc += a.credit;
    });

    doc.moveDown();
    doc.fontSize(11).text(`Total Debits: UGX ${td.toLocaleString()}`, { align: 'right' });
    doc.text(`Total Credits: UGX ${tc.toLocaleString()}`, { align: 'right' });
    doc.text(`Status: ${Math.abs(td - tc) < 0.01 ? 'BALANCED' : 'NOT BALANCED'}`, { align: 'right' });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PROFIT & LOSS PDF ====================
exports.profitLossPDF = async (req, res) => {
  try {
    const txns = await BusinessTransaction.find();
    const businesses = await Business.find();
    const ClubExpense = require('../models/ClubExpense');
    const clubExpenses = await ClubExpense.find();
    const totalClubExpenses = clubExpenses.reduce((s, e) => s + e.amount, 0);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=profit-loss.pdf');
    doc.pipe(res);

    createHeader(doc, 'Profit & Loss Statement');
    tableHeader(doc, ['Business', 'Revenue', 'Expenses', 'Losses', 'Net Profit']);

    let totalRev = 0, totalExp = 0, totalLoss = 0;
    for (const b of businesses) {
      const bTxns = txns.filter(t => t.businessId.toString() === b._id.toString());
      const revenue = bTxns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
      const expenses = bTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const losses = bTxns.filter(t => t.type === 'loss').reduce((s, t) => s + t.amount, 0);
      const net = revenue - expenses - losses;

      tableRow(doc, [b.name, revenue.toLocaleString(), expenses.toLocaleString(), losses.toLocaleString(), net.toLocaleString()]);
      totalRev += revenue;
      totalExp += expenses;
      totalLoss += losses;
    }

    doc.moveDown();
    doc.fontSize(11).text(`Total Revenue: UGX ${totalRev.toLocaleString()}`, { align: 'right' });
    doc.text(`Total Expenses: UGX ${totalExp.toLocaleString()}`, { align: 'right' });
    doc.text(`Total Losses: UGX ${totalLoss.toLocaleString()}`, { align: 'right' });
    doc.text(`Club Expenses: UGX ${totalClubExpenses.toLocaleString()}`, { align: 'right' });
    doc.text(`Net Profit: UGX ${(totalRev - totalExp - totalLoss - totalClubExpenses).toLocaleString()}`, { align: 'right' });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BALANCE SHEET PDF ====================
exports.balanceSheetPDF = async (req, res) => {
  try {
    const accounts = await Account.find();

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=balance-sheet.pdf');
    doc.pipe(res);

    createHeader(doc, 'Balance Sheet');

    const assets = accounts.filter(a => a.type === 'Asset');
    const liabilities = accounts.filter(a => a.type === 'Liability');
    const equity = accounts.filter(a => a.type === 'Equity');

    doc.fontSize(12).text('Assets', { underline: true });
    doc.moveDown(0.3);
    tableHeader(doc, ['Code', 'Account', 'Balance']);
    let totalAssets = 0;
    assets.forEach(a => {
      tableRow(doc, [a.code, a.name, a.balance.toLocaleString()]);
      totalAssets += a.balance;
    });
    doc.fontSize(11).text(`Total Assets: UGX ${totalAssets.toLocaleString()}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text('Liabilities', { underline: true });
    doc.moveDown(0.3);
    tableHeader(doc, ['Code', 'Account', 'Balance']);
    let totalLiab = 0;
    liabilities.forEach(a => {
      tableRow(doc, [a.code, a.name, (-a.balance).toLocaleString()]);
      totalLiab += -a.balance;
    });
    doc.fontSize(11).text(`Total Liabilities: UGX ${totalLiab.toLocaleString()}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text('Equity', { underline: true });
    doc.moveDown(0.3);
    tableHeader(doc, ['Code', 'Account', 'Balance']);
    let totalEquity = 0;
    equity.forEach(a => {
      tableRow(doc, [a.code, a.name, (-a.balance).toLocaleString()]);
      totalEquity += -a.balance;
    });
    doc.fontSize(11).text(`Total Equity: UGX ${totalEquity.toLocaleString()}`, { align: 'right' });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    createHeader(doc, `Transaction Report: ${business.name}`);
    tableHeader(doc, ['Date', 'Type', 'Amount', 'Description']);

    transactions.forEach(t => {
      tableRow(doc, [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.amount.toLocaleString(),
        t.description || '—'
      ]);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};