const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

async function generateStatementPDF(data, res) {
  const { member, from, to, entries, totals } = data;

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=statement-${member.memberNumber}.pdf`);
  doc.pipe(res);

  // ---- Fetch club profile + leaders ----
  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  const leaders = await Leader.find().sort('order');
  const treasurer = leaders.find(l => l.role === 'treasurer');
  const president = leaders.find(l => l.role === 'president');

  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const contactParts = [
    profile.location, profile.address, profile.postalAddress,
    profile.contact, profile.email, profile.website
  ].filter(Boolean);
  const clubContactLine = contactParts.join('  •  ');

  const M = 50;
  const pageW = doc.page.width;
  const contentW = pageW - (M * 2);

  // ==================== HEADER ====================
  const headerH = 105;
  doc.rect(0, 0, pageW, headerH).fill('#0f3460');

  const rightColW = 180;
  const leftColW = contentW - rightColW - 15;

  // Left column — club name (may wrap), contact line — flows
  let hY = 22;
  doc.fillColor('#fff').fontSize(15).font('Helvetica-Bold');
  doc.text(clubName, M, hY, { width: leftColW });
  hY = doc.y + 3;

  doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1');
  if (clubContactLine) {
    doc.text(clubContactLine, M, hY, { width: leftColW });
    hY = doc.y + 2;
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, hY, { width: leftColW });

  // Right column — title (fixed at top)
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(15);
  doc.text('MEMBER STATEMENT', pageW - M - rightColW, 30, { width: rightColW, align: 'right' });
  // ==================== MEMBER INFO ====================
  let y = 110;
  doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11);
  doc.text('Member:', M, y);
  doc.font('Helvetica').text(member.name, M + 70, y);

  doc.font('Helvetica-Bold').text('Member No:', pageW - M - 250, y);
  doc.font('Helvetica').text(member.memberNumber, pageW - M - 170, y);

  y += 20;
  doc.font('Helvetica-Bold').text('Period:', M, y);
  doc.font('Helvetica').text(
    `${new Date(from).toLocaleDateString()}  to  ${new Date(to).toLocaleDateString()}`,
    M + 70, y
  );

  y += 30;

  // ==================== LEDGER TABLE ====================
  const colDateX = M + 8;
  const colDescX = M + 90;
  const colInX = M + contentW - 260;
  const colOutX = M + contentW - 170;
  const colBalX = M + contentW - 90;
  const colW = 80;

  // Table header
  doc.rect(M, y, contentW, 26).fill('#0f3460');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  doc.text('DATE', colDateX, y + 8);
  doc.text('DESCRIPTION', colDescX, y + 8);
  doc.text('CASH IN', colInX, y + 8, { width: colW, align: 'right' });
  doc.text('CASH OUT', colOutX, y + 8, { width: colW, align: 'right' });
  doc.text('BALANCE', colBalX, y + 8, { width: colW, align: 'right' });
  y += 26;

  // Rows
  let rowIdx = 0;
  const rowH = 22;
  const maxY = doc.page.height - 200;

  for (const e of entries) {
    if (y > maxY) {
      doc.addPage();
      y = 50;
      // Repeat header on new page
      doc.rect(M, y, contentW, 26).fill('#0f3460');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
      doc.text('DATE', colDateX, y + 8);
      doc.text('DESCRIPTION', colDescX, y + 8);
      doc.text('CASH IN', colInX, y + 8, { width: colW, align: 'right' });
      doc.text('CASH OUT', colOutX, y + 8, { width: colW, align: 'right' });
      doc.text('BALANCE', colBalX, y + 8, { width: colW, align: 'right' });
      y += 26;
      rowIdx = 0;
    }

    if (rowIdx % 2 === 0) {
      doc.rect(M, y, contentW, rowH).fill('#f8fafc');
    }
    doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
    doc.text(new Date(e.date).toLocaleDateString(), colDateX, y + 6);
    doc.text(e.description || '—', colDescX, y + 6, { width: contentW - 340 });

    doc.font('Helvetica-Bold').fillColor(e.cashIn > 0 ? '#15803d' : '#94a3b8');
    doc.text(e.cashIn > 0 ? fmt(e.cashIn) : '—', colInX, y + 6, { width: colW, align: 'right' });

    doc.font('Helvetica-Bold').fillColor(e.cashOut > 0 ? '#dc2626' : '#94a3b8');
    doc.text(e.cashOut > 0 ? fmt(e.cashOut) : '—', colOutX, y + 6, { width: colW, align: 'right' });

    doc.font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(fmt(e.balance), colBalX, y + 6, { width: colW, align: 'right' });

    y += rowH;
    rowIdx++;
  }

  // ==================== TOTALS ====================
  y += 6;
  doc.rect(M, y, contentW, 30).fill('#0f3460');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11);
  doc.text('TOTALS', colDescX, y + 9);
  doc.fontSize(11);
  doc.text(fmt(totals.cashIn), colInX, y + 9, { width: colW, align: 'right' });
  doc.text(fmt(totals.cashOut), colOutX, y + 9, { width: colW, align: 'right' });
  doc.text(fmt(totals.closingBalance), colBalX, y + 9, { width: colW, align: 'right' });
  y += 40;

  // Closing balance highlight
  doc.rect(M, y, contentW, 32).fill('#dcfce7');
  doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(13);
  doc.text('CLOSING BALANCE:', colDescX, y + 9);
  doc.fontSize(15);
  doc.text(`UGX ${fmt(totals.closingBalance)}`, colBalX - 40, y + 7, { width: colW + 40, align: 'right' });

  // ==================== SIGNATURES ====================
  y += 70;
  if (y > doc.page.height - 150) {
    doc.addPage();
    y = 100;
  }

  const halfW = (contentW - 40) / 2;

  // Treasurer
  doc.moveTo(M, y).lineTo(M + halfW, y).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(10);
  doc.text('TREASURER', M, y + 6, { width: halfW });
  doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(11);
  doc.text(treasurer?.name || '__________________', M, y + 24, { width: halfW });
  doc.font('Helvetica').fillColor('#64748b').fontSize(9);
  doc.text('Date: ____________', M, y + 42, { width: halfW });

  // President
  const presX = M + halfW + 40;
  doc.moveTo(presX, y).lineTo(presX + halfW, y).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(10);
  doc.text('PRESIDENT', presX, y + 6, { width: halfW });
  doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(11);
  doc.text(president?.name || '__________________', presX, y + 24, { width: halfW });
  doc.font('Helvetica').fillColor('#64748b').fontSize(9);
  doc.text('Date: ____________', presX, y + 42, { width: halfW });

  // Footer
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94a3b8');
  doc.text(
    'This is a computer-generated statement. Retain for your records.',
    M, doc.page.height - 30, { width: contentW, align: 'center' }
  );

  doc.end();
}

module.exports = { generateStatementPDF };