const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== HEADER HELPER ====================
async function drawHeader(doc, title, subtitle = '') {
  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};

  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const contactParts = [
    profile.location, profile.address, profile.contact, profile.email
  ].filter(Boolean).join('  •  ');

  doc.rect(0, 0, doc.page.width, 90).fill('#0f3460');
  doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold');
  doc.text(clubName, 50, 25, { width: doc.page.width - 100 });

  doc.fontSize(12).font('Helvetica').text(title, 50, 55);
  if (subtitle) doc.fontSize(9).text(subtitle, 50, 72);
  doc.fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, 50, 78);

  doc.fillColor('#000').moveDown(3);
  doc.y = 110;
}

// ==================== SAVINGS REPORT ====================
async function generateSavingsReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=savings-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Savings Report', 'Summary of all savings activity');

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Grand Total: UGX ${fmt(data.grandTotal)}`);
  doc.text(`Total Transactions: ${data.totalTransactions}`);
  doc.text(`Categories: ${(data.byCategory || []).length}`);
  doc.moveDown(0.8);

  // By Category
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('BY CATEGORY', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('Category', 60, y + 6);
  doc.text('Amount (UGX)', doc.page.width - 200, y + 6, { width: 140, align: 'right' });
  y += 22;

  (data.byCategory || []).forEach((c, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(c.category, 60, y);
    doc.text(fmt(c.total), doc.page.width - 200, y, { width: 140, align: 'right' });
    y += 18;
  });

  // Top 15 Savers
  y += 15;
  if (y > doc.page.height - 250) { doc.addPage(); y = 50; }
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('TOP 15 SAVERS', 50, y);
  y += 20;

  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 60, y + 6);
  doc.text('Member', 90, y + 6);
  doc.text('Member No.', 350, y + 6);
  doc.text('Total', doc.page.width - 200, y + 6, { width: 140, align: 'right' });
  y += 22;

  (data.topMembers || []).forEach((m, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(String(i + 1), 60, y);
    doc.text(m.name, 90, y);
    doc.text(m.memberNumber, 350, y);
    doc.text(fmt(m.total), doc.page.width - 200, y, { width: 140, align: 'right' });
    y += 18;
  });

  doc.end();
}

// ==================== LOANS REPORT ====================
async function generateLoansReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=loans-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Loans Report', 'Portfolio health and outstanding loans');

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Total Loans: ${data.totalLoans}`);
  doc.text(`Total Disbursed: UGX ${fmt(data.totalDisbursed)}`);
  doc.text(`Total Repaid: UGX ${fmt(data.totalRepaid)}`);
  doc.text(`Total Outstanding: UGX ${fmt(data.totalOutstanding)}`);
  doc.text(`Overdue Installments: ${data.overdueCount}`);
  doc.moveDown(0.8);

  // By Status
  if ((data.byStatus || []).length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
    doc.text('BY STATUS', 50, doc.y);
    doc.moveDown(0.3);

    let y = doc.y;
    doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
    (data.byStatus || []).forEach(s => {
      doc.text(`${s.status}: ${s.count}`, 60, y);
      y += 15;
    });
    doc.y = y + 15;
  }

  // Outstanding Loans
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('OUTSTANDING LOANS', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('Member', 60, y + 6);
  doc.text('Type', 260, y + 6);
  doc.text('Amount', 350, y + 6, { width: 80, align: 'right' });
  doc.text('Outstanding', doc.page.width - 170, y + 6, { width: 110, align: 'right' });
  y += 22;

  (data.outstandingLoans || []).slice(0, 30).forEach((l, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(`${l.memberName} (${l.memberNumber})`, 60, y, { width: 195 });
    doc.text(l.loanType.replace('_', ' '), 260, y);
    doc.text(fmt(l.amount), 350, y, { width: 80, align: 'right' });
    doc.fillColor('#dc2626').font('Helvetica-Bold');
    doc.text(fmt(l.outstanding), doc.page.width - 170, y, { width: 110, align: 'right' });
    y += 18;
  });

  doc.end();
}

// ==================== MEMBERS REPORT ====================
async function generateMembersReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=members-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Members Report', 'Full member directory and statistics');

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Total Members: ${data.total}`);
  doc.text(`Active: ${data.active}   |   Inactive: ${data.inactive}`);
  doc.text(`With Active Loan: ${data.withActiveLoan}`);
  doc.text(`Total Shares Held: ${data.totalShares}`);
  doc.moveDown(0.8);

  // Members list
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('MEMBERS', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 60, y + 6);
  doc.text('Name', 85, y + 6);
  doc.text('Member No.', 260, y + 6);
  doc.text('Contact', 360, y + 6);
  doc.text('Savings', doc.page.width - 170, y + 6, { width: 110, align: 'right' });
  y += 22;

  (data.membersList || []).forEach((m, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(String(i + 1), 60, y);
    doc.text(m.name.slice(0, 30), 85, y, { width: 170 });
    doc.text(m.memberNumber, 260, y);
    doc.text(m.contact || '—', 360, y, { width: 95 });
    doc.text(fmt(m.savings), doc.page.width - 170, y, { width: 110, align: 'right' });
    y += 18;
  });

  doc.end();
}

// ==================== SHARES REPORT ====================
async function generateSharesReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=shares-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Shares Report', 'Share holdings across all members');

  const totals = data.totals || {};

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Total Shares: ${data.grandTotalQty}`);
  doc.text(`Total Value: UGX ${fmt(data.grandTotalValue)}`);
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('Breakdown by Type:', 50, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#1e293b').fontSize(10);
  doc.text(`Golden:   ${totals.golden?.qty || 0} shares @ UGX ${fmt(totals.golden?.price || 0)} = UGX ${fmt(totals.golden?.value || 0)}`);
  doc.text(`Platinum: ${totals.platinum?.qty || 0} shares @ UGX ${fmt(totals.platinum?.price || 0)} = UGX ${fmt(totals.platinum?.value || 0)}`);
  doc.text(`Silver:   ${totals.silver?.qty || 0} shares @ UGX ${fmt(totals.silver?.price || 0)} = UGX ${fmt(totals.silver?.value || 0)}`);
  doc.text(`Bronze:   ${totals.bronze?.qty || 0} shares @ UGX ${fmt(totals.bronze?.price || 0)} = UGX ${fmt(totals.bronze?.value || 0)}`);
  doc.moveDown(1);

  // By Member table
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('SHARES BY MEMBER', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('Member', 55, y + 6, { width: 130 });
  doc.text('Member No.', 190, y + 6, { width: 80 });
  doc.text('G', 275, y + 6, { width: 20, align: 'center' });
  doc.text('P', 300, y + 6, { width: 20, align: 'center' });
  doc.text('S', 325, y + 6, { width: 20, align: 'center' });
  doc.text('B', 350, y + 6, { width: 20, align: 'center' });
  doc.text('Total', 375, y + 6, { width: 40, align: 'center' });
  doc.text('Value (UGX)', doc.page.width - 130, y + 6, { width: 80, align: 'right' });
  y += 22;

  (data.byMember || []).forEach((m, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(m.name.slice(0, 22), 55, y, { width: 130 });
    doc.text(m.memberNumber, 190, y, { width: 80 });
    doc.text(String(m.golden), 275, y, { width: 20, align: 'center' });
    doc.text(String(m.platinum), 300, y, { width: 20, align: 'center' });
    doc.text(String(m.silver), 325, y, { width: 20, align: 'center' });
    doc.text(String(m.bronze), 350, y, { width: 20, align: 'center' });
    doc.font('Helvetica-Bold').text(String(m.total), 375, y, { width: 40, align: 'center' });
    doc.font('Helvetica').text(fmt(m.value), doc.page.width - 130, y, { width: 80, align: 'right' });
    y += 18;
  });

  doc.end();
}

// ==================== BUSINESS REPORT ====================
async function generateBusinessReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=business-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Business Report', 'Performance of all businesses');

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Total Businesses: ${data.totalBusinesses}`);
  doc.text(`Total Revenue: UGX ${fmt(data.totalRevenue)}`);
  doc.text(`Total Expenses: UGX ${fmt(data.totalExpenses)}`);
  doc.text(`Total Losses: UGX ${fmt(data.totalLosses)}`);
  doc.text(`Net Profit: UGX ${fmt(data.totalRevenue - data.totalExpenses - data.totalLosses)}`);
  doc.text(`Total Capital Allocated: UGX ${fmt(data.totalCapitalAllocated)}`);
  doc.text(`Total Profit Extracted: UGX ${fmt(data.totalProfitExtracted)}`);
  doc.moveDown(1);

  // By business
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('PERFORMANCE BY BUSINESS', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 20).fill('#0f3460');
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('Business', 55, y + 6, { width: 120 });
  doc.text('Revenue', 180, y + 6, { width: 70, align: 'right' });
  doc.text('Expenses', 255, y + 6, { width: 70, align: 'right' });
  doc.text('Net Profit', 330, y + 6, { width: 70, align: 'right' });
  doc.text('Balance', doc.page.width - 145, y + 6, { width: 95, align: 'right' });
  y += 22;

  (data.byBusiness || []).forEach((b, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(b.name.slice(0, 22), 55, y, { width: 120 });
    doc.text(fmt(b.revenue), 180, y, { width: 70, align: 'right' });
    doc.text(fmt(b.expenses), 255, y, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(b.netProfit >= 0 ? '#15803d' : '#dc2626');
    doc.text(fmt(b.netProfit), 330, y, { width: 70, align: 'right' });
    doc.fillColor('#1e293b').font('Helvetica');
    doc.text(fmt(b.currentBalance), doc.page.width - 145, y, { width: 95, align: 'right' });
    y += 18;
  });

  doc.end();
}

// ==================== EXPENSES REPORT ====================
async function generateExpensesReportPDF(data, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=expenses-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Expenses Report', 'Club and business expenses combined');

  const club = data.club || {};
  const business = data.business || {};

  // Summary
  doc.fillColor('#0f3460').fontSize(12).font('Helvetica-Bold');
  doc.text('SUMMARY', 50, doc.y);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
  doc.text(`Club Expenses: UGX ${fmt(club.total)} (${club.count || 0} transactions)`);
  doc.text(`Business Expenses: UGX ${fmt(business.total)} (${business.count || 0} transactions)`);
  doc.font('Helvetica-Bold').text(`Grand Total: UGX ${fmt(data.grandTotal)}`);
  doc.moveDown(1);

  // Club by category
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('CLUB EXPENSES BY CATEGORY', 50, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  if ((club.byCategory || []).length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No club expenses.', 55, y);
    y += 20;
  } else {
    (club.byCategory || []).forEach((c, i) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
      doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
      doc.text(c.category.replace('_', ' '), 60, y);
      doc.font('Helvetica-Bold').text(fmt(c.total), doc.page.width - 200, y, { width: 140, align: 'right' });
      y += 18;
    });
  }
  y += 15;

  // Business by category
  if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text('BUSINESS EXPENSES BY CATEGORY', 50, y);
  y += 20;

  if ((business.byCategory || []).length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No business expenses.', 55, y);
  } else {
    (business.byCategory || []).forEach((c, i) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      if (i % 2 === 0) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
      doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
      doc.text(c.category.replace('_', ' '), 60, y);
      doc.font('Helvetica-Bold').text(fmt(c.total), doc.page.width - 200, y, { width: 140, align: 'right' });
      y += 18;
    });
  }

  doc.end();
}

module.exports = {
  generateSavingsReportPDF,
  generateLoansReportPDF,
  generateMembersReportPDF,
  generateSharesReportPDF,
  generateBusinessReportPDF,
  generateExpensesReportPDF
};