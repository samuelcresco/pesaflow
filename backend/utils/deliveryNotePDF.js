const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');
const { getLeaderSignature } = require('./leaderHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

async function generateDeliveryNotePDF(note, res, requestedSigs) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const doc = new PDFDocument({ size: 'A5', margin: 0, layout: 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${note.noteNumber}.pdf`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 30;
  const contentW = pageW - (M * 2);

  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const clubTagline = profile.tagline || 'SACCO Management Platform';
  const contactParts = [profile.contact, profile.email, profile.location].filter(Boolean);
  const contactLine = contactParts.join('  •  ');

  const accent = '#0891b2';

  // ── Top accent bar ──
  doc.rect(0, 0, pageW, 8).fill(accent);

  // ── 1. Club name — large + bold, on its own line ──
  doc.fillColor('#0f3460').fontSize(16).font('Helvetica-Bold');
  doc.text(clubName.toUpperCase(), M, 26, { width: contentW, align: 'center' });

  // ── 2. Tagline ("Strengthen Wealth") — clearly separated below the name, bold + larger ──
  if (clubTagline) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569');
    doc.text(clubTagline, M, 64, { width: contentW, align: 'center' });
  }

  // ── 3. Contact line — grouped with the tagline, bold + visible ──
  if (contactLine) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748b');
    doc.text(contactLine, M, 82, { width: contentW, align: 'center', lineGap: 2 });
  }

  // ── 4. DELIVERY NOTE title + note number (right side, below the identity block) ──
  const rightW = 140;
  const dnY = 115;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(accent);
  doc.text('DELIVERY NOTE', pageW - M - rightW, dnY, { width: rightW, align: 'right' });
  doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
  doc.text('Note No.', pageW - M - rightW, dnY + 20, { width: rightW, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f3460');
  doc.text(note.noteNumber, pageW - M - rightW, dnY + 32, { width: rightW, align: 'right' });

  // ── 5. Divider ──
  doc.moveTo(M, 166).lineTo(pageW - M, 166).strokeColor('#cbd5e1').lineWidth(1).stroke();

  const dateStr = new Date(note.date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  let y = 176;
  doc.fontSize(8).fillColor('#1e293b').font('Helvetica-Bold');
  doc.text('Deliver To:', M, y);
  doc.font('Helvetica').fontSize(10).text(note.recipientName || '—', M + 60, y - 2);

  doc.font('Helvetica-Bold').fontSize(8).text('Date:', pageW - 130, y);
  doc.font('Helvetica').fontSize(8).text(dateStr, pageW - 95, y);

  y += 16;
  if (note.recipientContact) {
    doc.font('Helvetica-Bold').fontSize(8).text('Contact:', M, y);
    doc.font('Helvetica').text(note.recipientContact, M + 60, y);
    y += 14;
  }
  if (note.recipientAddress) {
    doc.font('Helvetica-Bold').fontSize(8).text('Address:', M, y);
    doc.font('Helvetica').text(note.recipientAddress, M + 60, y, { width: contentW - 60 });
    y += 14;
  }

  y += 8;
  const colItemX = M + 8;
  const colQtyX = M + contentW - 200;
  const colUnitX = M + contentW - 160;
  const colPriceX = M + contentW - 100;
  const colAmtX = M + contentW - 55;
  const colW = 50;

  doc.rect(M, y, contentW, 20).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5);
  doc.text('DESCRIPTION', colItemX, y + 6);
  doc.text('QTY', colQtyX, y + 6, { width: 30, align: 'center' });
  doc.text('UNIT', colUnitX, y + 6, { width: 40, align: 'center' });
  doc.text('PRICE', colPriceX, y + 6, { width: colW, align: 'right' });
  doc.text('TOTAL', colAmtX, y + 6, { width: colW, align: 'right' });
  y += 20;

  let rowIdx = 0;
  for (const item of note.items || []) {
    if (rowIdx % 2 === 0) doc.rect(M, y, contentW, 20).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8);
    doc.text(item.description || '—', colItemX, y + 6, { width: contentW - 220 });
    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    doc.text(String(item.quantity), colQtyX, y + 6, { width: 30, align: 'center' });
    doc.text(item.unit || 'pcs', colUnitX, y + 6, { width: 40, align: 'center' });
    doc.text(item.unitPrice > 0 ? fmt(item.unitPrice) : '—', colPriceX, y + 6, { width: colW, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(item.lineTotal > 0 ? fmt(item.lineTotal) : '—', colAmtX, y + 6, { width: colW, align: 'right' });
    y += 20;
    rowIdx++;
  }

  if (note.totalValue > 0) {
    y += 4;
    doc.rect(M, y, contentW, 30).fill(accent);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL VALUE', colItemX, y + 10);
    doc.fontSize(12).text(`UGX ${fmt(note.totalValue)}`, colAmtX - 80, y + 10, { width: colW + 80, align: 'right' });
    y += 38;
  } else {
    y += 10;
  }

  if (note.notes) {
    doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(8);
    doc.text('Notes:', M, y);
    doc.font('Helvetica').fillColor('#1e293b').text(note.notes, M + 40, y, { width: contentW - 40 });
    y += 18;
  }

  // ==================== DYNAMIC SIGNATURES ====================
  const bottomY = pageH - 130;
  const qrSize = 75;
  const qrX = M;
  try {
    const qrUrl = `http://192.168.1.6:5000/api/delivery-notes/verify/${note.noteNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: qrSize });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, bottomY, { width: qrSize, height: qrSize });
    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text('Scan to verify', qrX, bottomY + qrSize + 2, { width: qrSize, align: 'center' });
  } catch (e) { console.error('QR error:', e.message); }

  const sigStartX = M + qrSize + 20;
  const sigAreaW = contentW - qrSize - 20;

  const customerSigW = 80;
  const leaderAreaW = sigAreaW - customerSigW - 15;

  let signatories = requestedSigs && requestedSigs.length > 0 ? requestedSigs : ['treasurer'];
  const numSigs = signatories.length;
  const spacing = 10;
  const sigW = (leaderAreaW - (numSigs - 1) * spacing) / numSigs;

  for (let i = 0; i < numSigs; i++) {
    const role = signatories[i];
    const x = sigStartX + i * (sigW + spacing);

    const leader = await Leader.findOne({ role, active: true });
    const sigBuffer = await getLeaderSignature(role);

    doc.moveTo(x, bottomY + 40).lineTo(x + sigW, bottomY + 40).strokeColor('#1e293b').lineWidth(0.8).stroke();

    if (sigBuffer) {
      try {
        doc.image(sigBuffer, x, bottomY + 22, { fit: [sigW, 15], align: 'center', valign: 'bottom' });
      } catch (e) {}
    }

    doc.font('Helvetica-Bold').fillColor(accent).fontSize(6.5);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, bottomY + 45, { width: sigW, align: 'center' });
    doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(7.5);
    doc.text(leader?.name || '__________________', x, bottomY + 56, { width: sigW, align: 'center' });
  }

  const recX = sigStartX + leaderAreaW + 15;
  doc.moveTo(recX, bottomY + 40).lineTo(recX + customerSigW, bottomY + 40).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor(accent).fontSize(6.5);
  doc.text('RECEIVED BY', recX, bottomY + 45, { width: customerSigW, align: 'center' });

  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#94a3b8');
  doc.text('This is a computer-generated delivery note. Retain for your records.', 0, pageH - 15, { align: 'center', width: pageW });

  doc.end();
}

module.exports = { generateDeliveryNotePDF };