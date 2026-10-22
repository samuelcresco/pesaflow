const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');
const { drawSignatures } = require('./pdfHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');
const ACCENT = '#0f3460';

// ==================== HEADER ====================
async function drawHeader(doc, title, subtitle = '') {
  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};

  const clubName = (profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase();
  const pageW = doc.page.width;
  const M = 50;
  const contentW = pageW - (M * 2);

  // Top accent bar
  doc.rect(0, 0, pageW, 6).fill(ACCENT);

  // Club name — bold, centered; auto-shrinks if it would wrap past 2 lines
  doc.fillColor(ACCENT).font('Helvetica-Bold');
  let nameSize = 17;
  doc.fontSize(nameSize);
  while (nameSize > 12 && doc.widthOfString(clubName) > contentW) {
    nameSize -= 1;
    doc.fontSize(nameSize);
  }
  doc.text(clubName, M, 22, { width: contentW, align: 'center' });

  // Title — spaced relative to where the club name ended
  doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold');
  doc.text(title, M, doc.y + 16, { width: contentW, align: 'center' });

  // Subtitle — optional
  if (subtitle) {
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b');
    doc.text(subtitle, M, doc.y + 3, { width: contentW, align: 'center' });
  }

  // Generated line — right aligned, small gray
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, doc.y + 6, {
    width: contentW, align: 'right'
  });

  // Reset for content
  doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
  doc.y = doc.y + 20;
}

function setNoCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ==================== SECTION HELPERS ====================
function drawSectionTitle(doc, title) {
  doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT);
  doc.text(title, 50, doc.y);
  doc.moveDown(0.5);
}

function drawSummaryRows(doc, rows) {
  let y = doc.y;
  rows.forEach(([label, value]) => {
    doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(label, 55, y);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
      .text(String(value), 250, y, { width: doc.page.width - 300, align: 'right' });
    y += 16;
  });
  doc.y = y + 8;
}

// ==================== SAVINGS REPORT ====================
async function generateSavingsReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=savings-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Savings Report', 'Summary of all savings activity');

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Grand Total', `UGX ${fmt(data.grandTotal)}`],
    ['Total Transactions', data.totalTransactions],
    ['Categories', (data.byCategory || []).length]
  ]);

  drawSectionTitle(doc, 'BY CATEGORY');
  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold');
  doc.text('Category', 56, y + 6);
  doc.text('Amount (UGX)', 50, y + 6, { width: doc.page.width - 106, align: 'right' });
  y += 26;

  (data.byCategory || []).forEach((c, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(c.category, 56, y);
    doc.text(fmt(c.total), 50, y, { width: doc.page.width - 106, align: 'right' });
    y += 18;
  });

  y += 15;
  if (y > doc.page.height - 250) { doc.addPage(); y = 60; }
  doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT);
  doc.text('TOP 15 SAVERS', 50, y);
  y += 22;

  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 56, y + 6);
  doc.text('Member', 85, y + 6);
  doc.text('Member No.', 350, y + 6);
  doc.text('Total', 50, y + 6, { width: doc.page.width - 106, align: 'right' });
  y += 26;

  (data.topMembers || []).forEach((m, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(String(i + 1), 56, y);
    doc.text(m.name, 85, y);
    doc.text(m.memberNumber, 350, y);
    doc.text(fmt(m.total), 50, y, { width: doc.page.width - 106, align: 'right' });
    y += 18;
  });

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
  doc.end();
}

// ==================== LOANS REPORT ====================
async function generateLoansReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=loans-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Loans Report', 'Portfolio health and outstanding loans');

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Total Loans', data.totalLoans],
    ['Total Disbursed', `UGX ${fmt(data.totalDisbursed)}`],
    ['Total Repaid', `UGX ${fmt(data.totalRepaid)}`],
    ['Total Outstanding', `UGX ${fmt(data.totalOutstanding)}`],
    ['Overdue Installments', data.overdueCount]
  ]);

  if ((data.byStatus || []).length > 0) {
    drawSectionTitle(doc, 'BY STATUS');
    let sy = doc.y;
    doc.fontSize(10).font('Helvetica').fillColor('#1e293b');
    (data.byStatus || []).forEach(s => {
      doc.text(`${s.status}: ${s.count}`, 55, sy);
      sy += 15;
    });
    doc.y = sy + 10;
  }

  drawSectionTitle(doc, 'OUTSTANDING LOANS');

  // ── Column layout: no overlap ──
  // Page width 595, margins 50 → content 50–545 (495pt)
  //   Member:      56 → 236   (180pt)
  //   Type:        240 → 330  ( 90pt)
  //   Amount:      335 → 425  ( 90pt, right-aligned)
  //   Outstanding: 430 → 545  (115pt, right-aligned)
  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('Member', 56, y + 6, { width: 180 });
  doc.text('Type', 240, y + 6, { width: 90 });
  doc.text('Amount', 335, y + 6, { width: 90, align: 'right' });
  doc.text('Outstanding', 430, y + 6, { width: 115, align: 'right' });
  y += 26;

  (data.outstandingLoans || []).slice(0, 30).forEach((l, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(`${l.memberName} (${l.memberNumber})`, 56, y, { width: 180 });
    doc.text(l.loanType.replace('_', ' '), 240, y, { width: 90 });
    doc.text(fmt(l.amount), 335, y, { width: 90, align: 'right' });
    doc.fillColor('#dc2626').font('Helvetica-Bold');
    doc.text(fmt(l.outstanding), 430, y, { width: 115, align: 'right' });
    y += 18;
  });

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
  doc.end();
}

// ==================== MEMBERS REPORT ====================
async function generateMembersReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=members-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Members Report', 'Full member directory and statistics');

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Total Members', data.total],
    ['Active', data.active],
    ['Inactive', data.inactive],
    ['With Active Loan', data.withActiveLoan],
    ['Total Shares Held', data.totalShares]
  ]);

  drawSectionTitle(doc, 'MEMBERS');
  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('#', 56, y + 6);
  doc.text('Name', 85, y + 6);
  doc.text('Member No.', 260, y + 6);
  doc.text('Contact', 360, y + 6);
  doc.text('Savings', 50, y + 6, { width: doc.page.width - 106, align: 'right' });
  y += 26;

  (data.membersList || []).forEach((m, i) => {
    if (y > doc.page.height - 100) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(String(i + 1), 56, y);
    doc.text(m.name.slice(0, 30), 85, y, { width: 170 });
    doc.text(m.memberNumber, 260, y);
    doc.text(m.contact || '—', 360, y, { width: 95 });
    doc.text(fmt(m.savings), 50, y, { width: doc.page.width - 106, align: 'right' });
    y += 18;
  });

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
  doc.end();
}

// ==================== SHARES REPORT ====================
async function generateSharesReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=shares-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Shares Report', 'Share holdings across all members');

  const totals = data.totals || {};

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Total Shares', data.grandTotalQty],
    ['Total Value', `UGX ${fmt(data.grandTotalValue)}`]
  ]);

  drawSectionTitle(doc, 'BREAKDOWN BY TYPE');
  doc.font('Helvetica').fillColor('#1e293b').fontSize(10);
  doc.text(`Golden:   ${totals.golden?.qty || 0} shares @ UGX ${fmt(totals.golden?.price || 0)} = UGX ${fmt(totals.golden?.value || 0)}`);
  doc.text(`Platinum: ${totals.platinum?.qty || 0} shares @ UGX ${fmt(totals.platinum?.price || 0)} = UGX ${fmt(totals.platinum?.value || 0)}`);
  doc.text(`Silver:   ${totals.silver?.qty || 0} shares @ UGX ${fmt(totals.silver?.price || 0)} = UGX ${fmt(totals.silver?.value || 0)}`);
  doc.text(`Bronze:   ${totals.bronze?.qty || 0} shares @ UGX ${fmt(totals.bronze?.price || 0)} = UGX ${fmt(totals.bronze?.value || 0)}`);
  doc.moveDown(1);

  drawSectionTitle(doc, 'SHARES BY MEMBER');
  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('Member', 56, y + 6, { width: 130 });
  doc.text('Member No.', 190, y + 6, { width: 80 });
  doc.text('G', 275, y + 6, { width: 20, align: 'center' });
  doc.text('P', 300, y + 6, { width: 20, align: 'center' });
  doc.text('S', 325, y + 6, { width: 20, align: 'center' });
  doc.text('B', 350, y + 6, { width: 20, align: 'center' });
  doc.text('Total', 375, y + 6, { width: 40, align: 'center' });
  doc.text('Value (UGX)', 50, y + 6, { width: doc.page.width - 180, align: 'right' });
  y += 26;

  (data.byMember || []).forEach((m, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(m.name.slice(0, 22), 56, y, { width: 130 });
    doc.text(m.memberNumber, 190, y, { width: 80 });
    doc.text(String(m.golden), 275, y, { width: 20, align: 'center' });
    doc.text(String(m.platinum), 300, y, { width: 20, align: 'center' });
    doc.text(String(m.silver), 325, y, { width: 20, align: 'center' });
    doc.text(String(m.bronze), 350, y, { width: 20, align: 'center' });
    doc.font('Helvetica-Bold').text(String(m.total), 375, y, { width: 40, align: 'center' });
    doc.font('Helvetica').text(fmt(m.value), 50, y, { width: doc.page.width - 180, align: 'right' });
    y += 18;
  });

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
  doc.end();
}

// ==================== BUSINESS REPORT ====================
async function generateBusinessReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=business-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Business Report', 'Performance of all businesses');

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Total Businesses', data.totalBusinesses],
    ['Total Revenue', `UGX ${fmt(data.totalRevenue)}`],
    ['Total Expenses', `UGX ${fmt(data.totalExpenses)}`],
    ['Total Losses', `UGX ${fmt(data.totalLosses)}`],
    ['Net Profit', `UGX ${fmt(data.totalRevenue - data.totalExpenses - data.totalLosses)}`],
    ['Total Capital Allocated', `UGX ${fmt(data.totalCapitalAllocated)}`],
    ['Total Profit Extracted', `UGX ${fmt(data.totalProfitExtracted)}`]
  ]);

  drawSectionTitle(doc, 'PERFORMANCE BY BUSINESS');
  let y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 22).fill(ACCENT);
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('Business', 56, y + 6, { width: 120 });
  doc.text('Revenue', 180, y + 6, { width: 70, align: 'right' });
  doc.text('Expenses', 255, y + 6, { width: 70, align: 'right' });
  doc.text('Net Profit', 330, y + 6, { width: 70, align: 'right' });
  doc.text('Balance', 50, y + 6, { width: doc.page.width - 160, align: 'right' });
  y += 26;

  (data.byBusiness || []).forEach((b, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
    if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(b.name.slice(0, 22), 56, y, { width: 120 });
    doc.text(fmt(b.revenue), 180, y, { width: 70, align: 'right' });
    doc.text(fmt(b.expenses), 255, y, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').fillColor(b.netProfit >= 0 ? '#15803d' : '#dc2626');
    doc.text(fmt(b.netProfit), 330, y, { width: 70, align: 'right' });
    doc.fillColor('#1e293b').font('Helvetica');
    doc.text(fmt(b.currentBalance), 50, y, { width: doc.page.width - 160, align: 'right' });
    y += 18;
  });

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
  doc.end();
}

// ==================== EXPENSES REPORT ====================
async function generateExpensesReportPDF(data, res, requestedSigs = []) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  setNoCache(res);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=expenses-report.pdf');
  doc.pipe(res);

  await drawHeader(doc, 'Expenses Report', 'Club and business expenses combined');

  const club = data.club || {};
  const business = data.business || {};

  drawSectionTitle(doc, 'SUMMARY');
  drawSummaryRows(doc, [
    ['Club Expenses', `UGX ${fmt(club.total)} (${club.count || 0} txns)`],
    ['Business Expenses', `UGX ${fmt(business.total)} (${business.count || 0} txns)`],
    ['Grand Total', `UGX ${fmt(data.grandTotal)}`]
  ]);

  drawSectionTitle(doc, 'CLUB EXPENSES BY CATEGORY');
  let y = doc.y;
  if ((club.byCategory || []).length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No club expenses.', 56, y);
    y += 20;
  } else {
    (club.byCategory || []).forEach((c, i) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
      if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
      doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
      doc.text(c.category.replace('_', ' '), 56, y);
      doc.font('Helvetica-Bold').text(fmt(c.total), 50, y, { width: doc.page.width - 106, align: 'right' });
      y += 18;
    });
  }
  y += 15;

  if (y > doc.page.height - 150) { doc.addPage(); y = 60; }
  doc.fontSize(12).font('Helvetica-Bold').fillColor(ACCENT);
  doc.text('BUSINESS EXPENSES BY CATEGORY', 50, y);
  y += 22;

  if ((business.byCategory || []).length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No business expenses.', 56, y);
    y += 20;
  } else {
    (business.byCategory || []).forEach((c, i) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
      if (i % 2 === 1) doc.rect(50, y - 2, doc.page.width - 100, 18).fill('#f8fafc');
      doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
      doc.text(c.category.replace('_', ' '), 56, y);
      doc.font('Helvetica-Bold').text(fmt(c.total), 50, y, { width: doc.page.width - 106, align: 'right' });
      y += 18;
    });
  }

  doc.y = y;
  await drawSignatures(doc, requestedSigs);
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