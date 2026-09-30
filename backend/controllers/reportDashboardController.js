const Member = require('../models/Member');
const Saving = require('../models/Saving');
const Loan = require('../models/Loan');
const Repayment = require('../models/Repayment');
const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const ClubExpense = require('../models/ClubExpense');
const Dividend = require('../models/Dividend');
const Investment = require('../models/Investment');
const Account = require('../models/Account');
const Withdrawal = require('../models/Withdrawal');
const {
  generateSavingsReportPDF,
  generateLoansReportPDF,
  generateMembersReportPDF,
  generateSharesReportPDF,
  generateBusinessReportPDF,
  generateExpensesReportPDF
} = require('../utils/reportPDFTemplates');
const fmt = (n) => Number(n) || 0;

// ==================== OVERVIEW DASHBOARD ====================
exports.getOverview = async (req, res) => {
  try {
    const [members, savings, loans, businesses, expenses, dividends, investments, withdrawals] = await Promise.all([
      Member.find(),
      Saving.find(),
      Loan.find(),
      Business.find(),
      ClubExpense.find(),
      Dividend.find(),
      Investment.find(),
      Withdrawal.find({ status: 'paid' })
    ]);

    const clubCapitalAcc = await Account.findOne({ code: '1000' });
    const savingsAcc = await Account.findOne({ code: '1010' });
    const loanFundAcc = await Account.findOne({ code: '1100' });
    const profitPoolAcc = await Account.findOne({ code: '1400' });
    const interestFundAcc = await Account.findOne({ code: '1300' });
    const receivableAcc = await Account.findOne({ code: '1150' });

    const totalClubCapital = fmt(clubCapitalAcc?.balance);
    const totalMemberSavings = members.reduce((s, m) => s + fmt(m.savings), 0);
    const totalDividendBalance = members.reduce((s, m) => s + fmt(m.dividendBalance), 0);
    const totalSharesValue = members.reduce((s, m) => {
      const sh = m.shares || {};
      return s + (sh.golden || 0) * 5000 + (sh.platinum || 0) * 20000 + (sh.silver || 0) * 15000 + (sh.bronze || 0) * 10000;
    }, 0);

    const activeLoans = loans.filter(l => ['active', 'disbursed'].includes(l.status));
    const totalLoansOutstanding = activeLoans.reduce((s, l) => s + fmt(l.outstandingBalance || l.totalRepayable), 0);

    const totalClubExpenses = expenses.reduce((s, e) => s + fmt(e.amount), 0);

    const totalBusinessRevenue = businesses.reduce((s, b) => s + fmt(b.currentBalance), 0);

    // Savings trend - last 12 months
    const savingsTrend = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const total = savings
        .filter(s => {
          const sd = new Date(s.date);
          return sd.getMonth() + 1 === month && sd.getFullYear() === year;
        })
        .reduce((sum, s) => sum + fmt(s.amount), 0);
      savingsTrend.push({
        month: d.toLocaleString('en-GB', { month: 'short' }),
        year,
        total
      });
    }

    // Loans trend - last 12 months
    const loansTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const disbursed = loans
        .filter(l => {
          if (!l.disbursedDate) return false;
          const ld = new Date(l.disbursedDate);
          return ld.getMonth() + 1 === month && ld.getFullYear() === year;
        })
        .reduce((sum, l) => sum + fmt(l.amount), 0);

      const repaid = await Repayment.find({
        status: 'paid',
        paidDate: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) }
      });
      const totalRepaid = repaid.reduce((s, r) => s + fmt(r.amountPaid), 0);

      loansTrend.push({
        month: d.toLocaleString('en-GB', { month: 'short' }),
        year,
        disbursed,
        repaid: totalRepaid
      });
    }

    // Member growth - last 12 months
    const memberGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const count = members.filter(m => {
        const cd = new Date(m.createdAt);
        return cd.getMonth() + 1 === month && cd.getFullYear() === year;
      }).length;
      memberGrowth.push({
        month: d.toLocaleString('en-GB', { month: 'short' }),
        year,
        count
      });
    }

    // Loans by status
    const loansByStatus = {
      pending: loans.filter(l => l.status === 'pending').length,
      approved: loans.filter(l => l.status === 'approved').length,
      disbursed: loans.filter(l => l.status === 'disbursed').length,
      active: loans.filter(l => l.status === 'active').length,
      closed: loans.filter(l => l.status === 'closed').length,
      rejected: loans.filter(l => l.status === 'rejected').length,
      writeOff: loans.filter(l => l.status === 'writeOff').length
    };

    // Savings by category
    const categoryTotals = {};
    savings.forEach(s => {
      categoryTotals[s.category] = (categoryTotals[s.category] || 0) + fmt(s.amount);
    });
    const savingsByCategory = Object.entries(categoryTotals).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

    // Expenses by category
    const expTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'other';
      expTotals[cat] = (expTotals[cat] || 0) + fmt(e.amount);
    });
    const expensesByCategory = Object.entries(expTotals).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

    // Top members by savings
    const topSavers = members
      .map(m => ({ name: `${m.firstName} ${m.surname}`, memberNumber: m.memberNumber, savings: fmt(m.savings) }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 10);

    // Business performance
    const businessPerformance = [];
    for (const b of businesses) {
      const txns = await BusinessTransaction.find({ businessId: b._id });
      const revenue = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + fmt(t.amount), 0);
      const exp = txns.filter(t => t.type === 'expense').reduce((s, t) => s + fmt(t.amount), 0);
      const loss = txns.filter(t => t.type === 'loss').reduce((s, t) => s + fmt(t.amount), 0);
      businessPerformance.push({
        _id: b._id,
        name: b.name,
        isSystem: b.isSystem,
        currentBalance: fmt(b.currentBalance),
        totalProfitExtracted: fmt(b.totalProfitExtracted),
        revenue,
        expenses: exp,
        losses: loss,
        netProfit: revenue - exp - loss
      });
    }

    // Recent activity (last 20 savings)
    const recentActivity = savings
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15)
      .map(s => ({
        date: s.date,
        category: s.category,
        amount: s.amount,
        type: 'savings'
      }));

    res.json({
      overview: {
        totalClubCapital,
        totalMemberSavings,
        totalDividendBalance,
        totalSharesValue,
        totalLoansOutstanding,
        totalMembers: members.length,
        activeMembers: members.filter(m => m.active).length,
        totalActiveLoans: activeLoans.length,
        totalClubExpenses,
        totalBusinessRevenue,
        loanFundBalance: fmt(loanFundAcc?.balance),
        profitPoolBalance: fmt(profitPoolAcc?.balance),
        interestFundBalance: fmt(interestFundAcc?.balance),
        loansReceivable: fmt(receivableAcc?.balance),
        totalDividendsPaid: dividends.reduce((s, d) => s + fmt(d.totalAmount), 0),
        totalInvestmentsValue: investments.reduce((s, inv) => s + fmt(inv.purchaseCost), 0),
        totalWithdrawalsPaid: withdrawals.reduce((s, w) => s + fmt(w.amount), 0)
      },
      savingsTrend,
      loansTrend,
      memberGrowth,
      loansByStatus,
      savingsByCategory,
      expensesByCategory,
      topSavers,
      businessPerformance,
      recentActivity
    });
  } catch (error) {
    console.error('OVERVIEW ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== SAVINGS SUMMARY ====================
exports.getSavingsSummary = async (req, res) => {
  try {
    const savings = await Saving.find().populate('memberId', 'firstName surname memberNumber');
    const members = await Member.find();

    const byCategory = {};
    savings.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + fmt(s.amount);
    });

    const byMonth = {};
    savings.forEach(s => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + fmt(s.amount);
    });

    const topMembers = members
      .map(m => ({ name: `${m.firstName} ${m.surname}`, memberNumber: m.memberNumber, total: fmt(m.savings) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    res.json({
      byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
      byMonth: Object.entries(byMonth).map(([month, total]) => ({ month, total })).sort(),
      topMembers,
      totalTransactions: savings.length,
      grandTotal: savings.reduce((s, x) => s + fmt(x.amount), 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOANS SUMMARY ====================
exports.getLoansSummary = async (req, res) => {
  try {
    const loans = await Loan.find().populate('memberId', 'firstName surname memberNumber');
    const repayments = await Repayment.find({ status: 'paid' });

    const byStatus = {};
    const byType = {};
    loans.forEach(l => {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      byType[l.type] = (byType[l.type] || 0) + fmt(l.amount);
    });

    const totalDisbursed = loans.filter(l => l.disbursedDate).reduce((s, l) => s + fmt(l.amount), 0);
    const totalRepaid = repayments.reduce((s, r) => s + fmt(r.amountPaid), 0);

    const outstanding = loans
      .filter(l => ['active', 'disbursed'].includes(l.status))
      .map(l => ({
        memberName: l.memberId ? `${l.memberId.firstName} ${l.memberId.surname}` : '—',
        memberNumber: l.memberId?.memberNumber || '',
        loanType: l.type,
        amount: fmt(l.amount),
        totalRepayable: fmt(l.totalRepayable),
        outstanding: fmt(l.totalRepayable) - repayments.filter(r => r.loanId.toString() === l._id.toString()).reduce((s, r) => s + fmt(r.amountPaid), 0),
        interestRate: l.interestRate,
        status: l.status
      }))
      .sort((a, b) => b.outstanding - a.outstanding);

    const now = new Date();
    const overdueRepayments = await Repayment.find({
      status: { $in: ['pending', 'overdue'] },
      dueDate: { $lt: now }
    }).populate({ path: 'loanId', populate: { path: 'memberId', select: 'firstName surname memberNumber' } });

    res.json({
      totalLoans: loans.length,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      byType: Object.entries(byType).map(([type, total]) => ({ type, total })),
      totalDisbursed,
      totalRepaid,
      totalOutstanding: totalDisbursed - totalRepaid,
      outstandingLoans: outstanding,
      overdueCount: overdueRepayments.length,
      overdueList: overdueRepayments.slice(0, 20).map(r => ({
        memberName: r.loanId?.memberId ? `${r.loanId.memberId.firstName} ${r.loanId.memberId.surname}` : '—',
        installmentNumber: r.installmentNumber,
        dueDate: r.dueDate,
        amountDue: fmt(r.amountDue)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBERS SUMMARY ====================
exports.getMembersSummary = async (req, res) => {
  try {
    const members = await Member.find();

    const totalShares = members.reduce((s, m) => {
      const sh = m.shares || {};
      return s + (sh.golden || 0) + (sh.platinum || 0) + (sh.silver || 0) + (sh.bronze || 0);
    }, 0);

    const shareBreakdown = {
      golden: members.reduce((s, m) => s + (m.shares?.golden || 0), 0),
      platinum: members.reduce((s, m) => s + (m.shares?.platinum || 0), 0),
      silver: members.reduce((s, m) => s + (m.shares?.silver || 0), 0),
      bronze: members.reduce((s, m) => s + (m.shares?.bronze || 0), 0)
    };

    const byMonth = {};
    members.forEach(m => {
      const d = new Date(m.createdAt || m.dateOfSubscription);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    res.json({
      total: members.length,
      active: members.filter(m => m.active).length,
      inactive: members.filter(m => !m.active).length,
      withActiveLoan: members.filter(m => m.activeLoanId).length,
      totalShares,
      shareBreakdown,
      byMonth: Object.entries(byMonth).map(([month, count]) => ({ month, count })).sort(),
      membersList: members.map(m => ({
        name: `${m.firstName} ${m.surname}`,
        memberNumber: m.memberNumber,
        contact: m.contact,
        savings: fmt(m.savings),
        shares: (m.shares?.golden || 0) + (m.shares?.platinum || 0) + (m.shares?.silver || 0) + (m.shares?.bronze || 0),
        active: m.active,
        hasLoan: !!m.activeLoanId
      })).sort((a, b) => b.savings - a.savings)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== SHARES SUMMARY ====================
exports.getSharesSummary = async (req, res) => {
  try {
    const members = await Member.find();

    const goldenPrice = 5000;
    const platinumPrice = 20000;
    const silverPrice = 15000;
    const bronzePrice = 10000;

    const golden = members.reduce((s, m) => s + (m.shares?.golden || 0), 0);
    const platinum = members.reduce((s, m) => s + (m.shares?.platinum || 0), 0);
    const silver = members.reduce((s, m) => s + (m.shares?.silver || 0), 0);
    const bronze = members.reduce((s, m) => s + (m.shares?.bronze || 0), 0);

    const byMember = members
      .map(m => {
        const sh = m.shares || {};
        const g = sh.golden || 0, p = sh.platinum || 0, s = sh.silver || 0, b = sh.bronze || 0;
        const total = g + p + s + b;
        const value = g * goldenPrice + p * platinumPrice + s * silverPrice + b * bronzePrice;
        return {
          name: `${m.firstName} ${m.surname}`,
          memberNumber: m.memberNumber,
          golden: g, platinum: p, silver: s, bronze: b,
          total, value
        };
      })
      .sort((a, b) => b.value - a.value);

    res.json({
      totals: {
        golden: { qty: golden, price: goldenPrice, value: golden * goldenPrice },
        platinum: { qty: platinum, price: platinumPrice, value: platinum * platinumPrice },
        silver: { qty: silver, price: silverPrice, value: silver * silverPrice },
        bronze: { qty: bronze, price: bronzePrice, value: bronze * bronzePrice }
      },
      grandTotalQty: golden + platinum + silver + bronze,
      grandTotalValue: golden * goldenPrice + platinum * platinumPrice + silver * silverPrice + bronze * bronzePrice,
      byMember
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== BUSINESS SUMMARY ====================
exports.getBusinessSummary = async (req, res) => {
  try {
    const businesses = await Business.find();
    const allTxns = await BusinessTransaction.find();

    const byBusiness = businesses.map(b => {
      const txns = allTxns.filter(t => t.businessId.toString() === b._id.toString());
      const revenue = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + fmt(t.amount), 0);
      const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + fmt(t.amount), 0);
      const losses = txns.filter(t => t.type === 'loss').reduce((s, t) => s + fmt(t.amount), 0);
      const capitalIn = txns.filter(t => t.type === 'capital_in').reduce((s, t) => s + fmt(t.amount), 0);
      const extracted = txns.filter(t => t.type === 'profit_extraction').reduce((s, t) => s + fmt(t.amount), 0);
      return {
        _id: b._id,
        name: b.name,
        isSystem: b.isSystem,
        type: b.type,
        currentBalance: fmt(b.currentBalance),
        totalCapitalAllocated: fmt(b.totalCapitalAllocated),
        totalProfitExtracted: fmt(b.totalProfitExtracted),
        revenue, expenses, losses, capitalIn, extracted,
        netProfit: revenue - expenses - losses
      };
    });

    res.json({
      totalBusinesses: businesses.length,
      totalRevenue: byBusiness.reduce((s, b) => s + b.revenue, 0),
      totalExpenses: byBusiness.reduce((s, b) => s + b.expenses, 0),
      totalLosses: byBusiness.reduce((s, b) => s + b.losses, 0),
      totalCapitalAllocated: byBusiness.reduce((s, b) => s + b.totalCapitalAllocated, 0),
      totalProfitExtracted: byBusiness.reduce((s, b) => s + b.totalProfitExtracted, 0),
      totalCurrentBalance: byBusiness.reduce((s, b) => s + b.currentBalance, 0),
      byBusiness
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXPENSES SUMMARY ====================
exports.getExpensesSummary = async (req, res) => {
  try {
    const clubExpenses = await ClubExpense.find();
    const bizExpenses = await BusinessTransaction.find({ type: 'expense' }).populate('businessId', 'name');

    const clubByCategory = {};
    clubExpenses.forEach(e => {
      const cat = e.category || 'other';
      clubByCategory[cat] = (clubByCategory[cat] || 0) + fmt(e.amount);
    });

    const bizByCategory = {};
    bizExpenses.forEach(e => {
      const cat = e.category || 'other';
      bizByCategory[cat] = (bizByCategory[cat] || 0) + fmt(e.amount);
    });

    const totalClub = clubExpenses.reduce((s, e) => s + fmt(e.amount), 0);
    const totalBiz = bizExpenses.reduce((s, e) => s + fmt(e.amount), 0);

    res.json({
      club: {
        total: totalClub,
        count: clubExpenses.length,
        byCategory: Object.entries(clubByCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        recent: clubExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20)
      },
      business: {
        total: totalBiz,
        count: bizExpenses.length,
        byCategory: Object.entries(bizByCategory).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        recent: bizExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map(e => ({
          date: e.date,
          description: e.description,
          category: e.category,
          amount: e.amount,
          business: e.businessId?.name || '—'
        }))
      },
      grandTotal: totalClub + totalBiz
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ==================== SAVINGS REPORT PDF ====================
exports.savingsReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      exports.getSavingsSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateSavingsReportPDF(result, res);
  } catch (e) {
    console.error('Savings PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

// ==================== LOANS REPORT PDF ====================
exports.loansReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve) => {
      exports.getLoansSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateLoansReportPDF(result, res);
  } catch (e) {
    console.error('Loans PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

// ==================== MEMBERS REPORT PDF ====================
exports.membersReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve) => {
      exports.getMembersSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateMembersReportPDF(result, res);
  } catch (e) {
    console.error('Members PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};
// ==================== SHARES REPORT PDF ====================
exports.sharesReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve) => {
      exports.getSharesSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateSharesReportPDF(result, res);
  } catch (e) {
    console.error('Shares PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

// ==================== BUSINESS REPORT PDF ====================
exports.businessReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve) => {
      exports.getBusinessSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateBusinessReportPDF(result, res);
  } catch (e) {
    console.error('Business PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

// ==================== EXPENSES REPORT PDF ====================
exports.expensesReportPDF = async (req, res) => {
  try {
    const result = await new Promise((resolve) => {
      exports.getExpensesSummary({}, { json: resolve, status: () => ({ json: resolve }) });
    });
    await generateExpensesReportPDF(result, res);
  } catch (e) {
    console.error('Expenses PDF error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};