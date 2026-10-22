const PDFDocument = require('pdfkit');
const Leader = require('../models/Leader');
const ClubProfile = require('../models/ClubProfile');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

async function generateWithdrawalStatementPDF({ member, withdrawals }, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=withdrawals-${member.memberNumber}.pdf`);
  doc.pipe(res);

  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  const clubName = (profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase();

  // Header
  doc.rect(0, 0, doc.page.width, 90).fill('#0f3460');
  doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text(clubName, 50, 25);
  doc.fontSize(11).font('Helvetica').text('Savings Withdrawal Statement', 50, 55);
  doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, 50, 70);

  // Member info
  doc.fillColor('#000').fontSize(11).font('Helvetica-Bold');
  doc.text('Member:', 50, 115);
  doc.font('Helvetica').text(`${member.firstName} ${member.surname}`, 120, 115);
  doc.font('Helvetica-Bold').text('Member No:', 350, 115);
  doc.font('Helvetica').text(member.memberNumber || '—', 430, 115);

  // Summary
  const paidOnly = withdrawals.filter(w => w.status === 'paid');
  const pending = withdrawals.filter(w => w.status === 'pending');
  const totalPaid = paidOnly.reduce((s, w) => s + Number(w.amount || 0), 0);
  const totalPending = pending.reduce((s, w) => s + Number(w.amount || 0), 0);

  let y = 150;
  doc.rect(50, y, doc.page.width - 100, 50).fill('#f1f5f9');
  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(9);
  doc.text('TOTAL PAID OUT', 65, y + 8);
  doc.text('TOTAL PENDING', 240, y + 8);
  doc.text('TOTAL REQUESTS', 415, y + 8);
  doc.fontSize(14);
  doc.fillColor('#15803d').text(`UGX ${fmt(totalPaid)}`, 65, y + 24);
  doc.fillColor('#b45309').text(`UGX ${fmt(totalPending)}`, 240, y + 24);
  doc.fillColor('#0f3460').text(`${withdrawals.length}`, 415, y + 24);

  y += 70;

  // Table header
  doc.rect(50, y, doc.page.width - 100, 22).fill('#0f3460');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  doc.text('Date', 60, y + 6, { width: 70 });
  doc.text('Source', 135, y + 6, { width: 60 });
  doc.text('Amount (UGX)', 200, y + 6, { width: 90, align: 'right' });
  doc.text('Status', 300, y + 6, { width: 70 });
  doc.text('Note / Reason', 380, y + 6, { width: 165 });
  y += 22;

  // Rows
  let rowIdx = 0;
  withdrawals.forEach(w => {
    if (y > doc.page.height - 140) {
      doc.addPage();
      y = 50;
    }
    if (rowIdx % 2 === 0) doc.rect(50, y, doc.page.width - 100, 20).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(8.5);
    doc.text(new Date(w.requestedDate).toLocaleDateString(), 60, y + 6, { width: 70 });
    doc.text(w.source || '—', 135, y + 6, { width: 60 });
    doc.text(fmt(w.amount), 200, y + 6, { width: 90, align: 'right' });
    const statusColor = w.status === 'paid' ? '#15803d' : w.status === 'rejected' ? '#dc2626' : w.status === 'pending' ? '#b45309' : '#475569';
    doc.fillColor(statusColor).font('Helvetica-Bold').text(String(w.status || '').toUpperCase(), 300, y + 6, { width: 70 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(7.5);
    const note = w.status === 'rejected' && w.rejectionReason ? `Rejected: ${w.rejectionReason}` : (w.notes || '—');
    doc.text(note, 380, y + 6, { width: 165, ellipsis: true });
    y += 20;
    rowIdx++;
  });

  // Signatures
  y = Math.max(y + 30, doc.page.height - 130);
  if (y > doc.page.height - 100) { doc.addPage(); y = 80; }

  const leaders = await Leader.find().sort('order');
  const treasurer = leaders.find(l => l.role === 'treasurer');
  const president = leaders.find(l => l.role === 'president');

  const w = (doc.page.width - 100) / 2;
  doc.fontSize(10).fillColor('#000').font('Helvetica');
  const sigs = [
    { title: 'Treasurer', name: treasurer?.name || '', x: 50 },
    { title: 'President', name: president?.name || '', x: 50 + w }
  ];
  sigs.forEach(s => {
    doc.moveTo(s.x, y).lineTo(s.x + w - 30, y).stroke();
    doc.font('Helvetica-Bold').text(s.title, s.x, y + 5, { width: w - 30 });
    doc.font('Helvetica').fontSize(9).fillColor('#666').text(s.name || '__________________', s.x, y + 20, { width: w - 30 });
    doc.fontSize(8).text('Date: ____________', s.x, y + 35, { width: w - 30 });
    doc.fontSize(10).fillColor('#000');
  });

  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#94a3b8');
  doc.text('This is a computer-generated statement. Retain for your records.', 50, doc.page.height - 30, { width: doc.page.width - 100, align: 'center' });

  doc.end();
}

module.exports = { generateWithdrawalStatementPDF };