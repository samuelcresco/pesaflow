const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== ARC TEXT HELPER ====================
function drawArcText(doc, text, cx, cy, radius, startAngle, endAngle, fontSize, color, isBottom = false) {
  const chars = String(text).split('');
  const n = chars.length;
  if (n === 0) return;
  const step = (endAngle - startAngle) / Math.max(1, n - 1);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);

  chars.forEach((char, i) => {
    const angle = startAngle + i * step;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    let rotDeg;
    if (!isBottom) {
      rotDeg = (angle * 180 / Math.PI) - 270;
    } else {
      rotDeg = 90 - (angle * 180 / Math.PI);
    }

    doc.save();
    doc.translate(x, y);
    doc.rotate(rotDeg);
    doc.text(char, 0, -fontSize / 3, { lineBreak: false });
    doc.restore();
  });
}

// ==================== STAR HELPER ====================
function drawStar(doc, cx, cy, size, color) {
  const points = 5;
  const outer = size;
  const inner = size * 0.45;
  doc.save();
  doc.fillColor(color);
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  }
  doc.closePath().fill();
  doc.restore();
}

// ==================== PROFESSIONAL SEAL ====================
function drawSeal(doc, cx, cy, r) {
  // Outer rings
  doc.circle(cx, cy, r).strokeColor('#c9a227').lineWidth(2.2).stroke();
  doc.circle(cx, cy, r - 3).strokeColor('#c9a227').lineWidth(0.6).stroke();
  doc.circle(cx, cy, r - 7).strokeColor('#0f3460').lineWidth(0.5).stroke();
  doc.circle(cx, cy, r - 9).strokeColor('#c9a227').lineWidth(0.4).stroke();

  // Dotted decorative ring
  const dotCount = 40;
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2;
    const dx = cx + (r - 11.5) * Math.cos(angle);
    const dy = cy + (r - 11.5) * Math.sin(angle);
    doc.circle(dx, dy, 0.55).fill('#c9a227');
  }

  // Arc text — top
  drawArcText(
    doc,
    'CRESTED SS INVESTMENT CLUB',
    cx, cy, r - 17,
    205 * Math.PI / 180, 335 * Math.PI / 180,
    Math.max(4.5, r * 0.16),
    '#0f3460',
    false
  );

  // Arc text — bottom
  drawArcText(
    doc,
    'OFFICIAL SEAL',
    cx, cy, r - 17,
    155 * Math.PI / 180, 25 * Math.PI / 180,
    Math.max(4, r * 0.14),
    '#c9a227',
    true
  );

  // Separator lines (left and right of center)
  const sepLen = r * 0.3;
  doc.moveTo(cx - sepLen - 6, cy).lineTo(cx - 6, cy).strokeColor('#c9a227').lineWidth(0.7).stroke();
  doc.moveTo(cx + 6, cy).lineTo(cx + sepLen + 6, cy).strokeColor('#c9a227').lineWidth(0.7).stroke();

  // Center star
  drawStar(doc, cx, cy, r * 0.22, '#c9a227');

  // Small text below center
  doc.fillColor('#0f3460').fontSize(Math.max(4.5, r * 0.13)).font('Helvetica-Bold');
  doc.text('SACCO', cx - 25, cy + 9, { width: 50, align: 'center' });
}

// ==================== MAIN GENERATOR ====================
async function generateShareCertificatePDF(cert, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${cert.certificateNumber}.pdf`);
  doc.pipe(res);

  // ---- Fetch club profile + leaders ----
  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  const leaders = await Leader.find().sort('order');
  const treasurer = leaders.find(l => l.role === 'treasurer');
  const president = leaders.find(l => l.role === 'president');
  const secretary = leaders.find(l => l.role === 'secretary');

  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const clubTagline = profile.tagline || 'SACCO Management Platform';
  const contactParts = [
    profile.location, profile.address, profile.postalAddress,
    profile.contact, profile.email, profile.website
  ].filter(Boolean);
  const contactLine = contactParts.join('  •  ');

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 30;
  const centerX = pageW / 2;

  // ==================== LAYERED BORDERS ====================
  doc.rect(0, 0, pageW, pageH).fill('#0f3460');
  doc.rect(10, 10, pageW - 20, pageH - 20).fill('#fdfcf7');
  doc.rect(18, 18, pageW - 36, pageH - 36).strokeColor('#c9a227').lineWidth(3).stroke();
  doc.rect(24, 24, pageW - 48, pageH - 48).strokeColor('#0f3460').lineWidth(0.8).stroke();
  doc.rect(28, 28, pageW - 56, pageH - 56).strokeColor('#c9a227').lineWidth(0.5).stroke();

  // ==================== CORNERS ====================
  const cornerSize = 30;
  const corners = [
    { x: 24, y: 24, dx: 1, dy: 1 },
    { x: pageW - 24, y: 24, dx: -1, dy: 1 },
    { x: 24, y: pageH - 24, dx: 1, dy: -1 },
    { x: pageW - 24, y: pageH - 24, dx: -1, dy: -1 }
  ];
  for (const c of corners) {
    doc.moveTo(c.x, c.y + c.dy * cornerSize).lineTo(c.x, c.y).lineTo(c.x + c.dx * cornerSize, c.y)
      .strokeColor('#c9a227').lineWidth(2).stroke();
    doc.moveTo(c.x + c.dx * 6, c.y + c.dy * 6).lineTo(c.x + c.dx * (cornerSize - 6), c.y + c.dy * 6)
      .strokeColor('#c9a227').lineWidth(0.5).stroke();
    doc.moveTo(c.x + c.dx * 6, c.y + c.dy * 6).lineTo(c.x + c.dx * 6, c.y + c.dy * (cornerSize - 6))
      .strokeColor('#c9a227').lineWidth(0.5).stroke();
  }

  // ==================== WATERMARK ====================
  doc.save();
  doc.fillColor('#0f3460').fillOpacity(0.04).fontSize(90).font('Helvetica-Bold');
  doc.text('CRESTED', 0, 220, { align: 'center', width: pageW });
  doc.text('SS CLUB', 0, 320, { align: 'center', width: pageW });
  doc.restore();

  // ==================== HEADER ====================
  doc.circle(centerX, 45, 3).fill('#c9a227');
  doc.moveTo(centerX - 30, 45).lineTo(centerX - 8, 45).strokeColor('#c9a227').lineWidth(0.5).stroke();
  doc.moveTo(centerX + 8, 45).lineTo(centerX + 30, 45).strokeColor('#c9a227').lineWidth(0.5).stroke();

  doc.fillColor('#0f3460').fontSize(18).font('Helvetica-Bold');
  doc.text(clubName, 0, 58, { align: 'center', width: pageW });

  if (clubTagline) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b');
    doc.text(clubTagline, 0, 82, { align: 'center', width: pageW });
  }

  if (contactLine) {
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
    doc.text(contactLine, M + 40, 95, { align: 'center', width: pageW - (M * 2) - 80 });
  }

  doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
  doc.text('Certificate No.', pageW - 190, 34, { width: 150, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f3460');
  doc.text(cert.certificateNumber, pageW - 190, 44, { width: 150, align: 'right' });

  // ==================== TITLE ====================
  doc.moveTo(centerX - 150, 118).lineTo(centerX + 150, 118).strokeColor('#c9a227').lineWidth(1).stroke();

  doc.fillColor('#c9a227').fontSize(34).font('Helvetica-Bold');
  doc.text('SHARE CERTIFICATE', 0, 126, { align: 'center', width: pageW, characterSpacing: 2 });

  doc.moveTo(centerX - 150, 174).lineTo(centerX + 150, 174).strokeColor('#c9a227').lineWidth(1).stroke();

  // ==================== BODY ====================
  doc.fillColor('#475569').fontSize(11).font('Helvetica-Oblique');
  doc.text('This is to certify that', 0, 192, { align: 'center', width: pageW });

  doc.fillColor('#0f3460').fontSize(24).font('Helvetica-Bold');
  doc.text(cert.memberName, 0, 210, { align: 'center', width: pageW });

  const nameWidth = doc.widthOfString(cert.memberName);
  doc.moveTo(centerX - nameWidth / 2, 240).lineTo(centerX + nameWidth / 2, 240)
    .strokeColor('#c9a227').lineWidth(0.8).stroke();

  doc.fillColor('#475569').fontSize(10).font('Helvetica');
  doc.text(`Member Number: ${cert.memberNumber}`, 0, 248, { align: 'center', width: pageW });

  doc.font('Helvetica-Oblique').fontSize(11);
  doc.text('is the registered owner of the following shares in the club:', 0, 268, { align: 'center', width: pageW });

  // ==================== SHARES TABLE ====================
  const tableW = 520;
  const tableX = (pageW - tableW) / 2;
  let y = 298;
  const rowH = 22;

  doc.rect(tableX, y, tableW, 24).fill('#0f3460');
  doc.rect(tableX, y, tableW, 24).strokeColor('#c9a227').lineWidth(0.8).stroke();
  doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold');
  doc.text('SHARE TYPE', tableX + 20, y + 7, { width: 180 });
  doc.text('QUANTITY', tableX + 200, y + 7, { width: 90, align: 'center' });
  doc.text('UNIT PRICE (UGX)', tableX + 290, y + 7, { width: 110, align: 'right' });
  doc.text('VALUE (UGX)', tableX + 400, y + 7, { width: 100, align: 'right' });
  y += 24;

  const types = ['golden', 'platinum', 'silver', 'bronze'];
  let rowIdx = 0;
  for (const t of types) {
    const data = cert.shares[t] || { qty: 0, price: 0, value: 0 };
    if (rowIdx % 2 === 0) doc.rect(tableX, y, tableW, rowH).fill('#f5f3ec');
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10);
    const label = t.charAt(0).toUpperCase() + t.slice(1);
    doc.text(label, tableX + 20, y + 6, { width: 180 });
    doc.font('Helvetica').fontSize(10);
    doc.text(String(data.qty || 0), tableX + 200, y + 6, { width: 90, align: 'center' });
    doc.text(fmt(data.price || 0), tableX + 290, y + 6, { width: 110, align: 'right' });
    doc.font('Helvetica-Bold').text(fmt(data.value || 0), tableX + 400, y + 6, { width: 100, align: 'right' });
    y += rowH;
    rowIdx++;
  }

  doc.rect(tableX, y, tableW, 30).fill('#c9a227');
  doc.rect(tableX, y, tableW, 30).strokeColor('#0f3460').lineWidth(0.5).stroke();
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11);
  doc.text('TOTAL', tableX + 20, y + 9, { width: 180 });
  doc.text(String(cert.totalQuantity || 0), tableX + 200, y + 9, { width: 90, align: 'center' });
  doc.text('', tableX + 290, y + 9, { width: 110 });
  doc.fontSize(13).text(fmt(cert.totalValue || 0), tableX + 390, y + 7, { width: 110, align: 'right' });

  // ==================== QR CODE (bottom left) ====================
  const qrSize = 70;
  const qrX = 55;
  const qrY = pageH - 130;
  try {
    const qrUrl = `http://192.168.1.6:5000/api/share-certificates/verify/${cert.certificateNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: qrSize });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text('Scan to verify', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' });
    doc.text(`Issued: ${new Date(cert.issueDate).toLocaleDateString('en-GB')}`, qrX, qrY + qrSize + 11, { width: qrSize, align: 'center' });
  } catch (e) {
    console.error('QR error:', e.message);
  }

  // ==================== SIGNATURES (row) ====================
  const sigY = pageH - 115;
  const sigW = 150;
  const sigs = [
    { role: 'TREASURER', name: treasurer?.name || '', x: pageW - 560 },
    { role: 'SECRETARY', name: secretary?.name || '', x: pageW - 380 },
    { role: 'PRESIDENT', name: president?.name || '', x: pageW - 200 }
  ];

  for (const s of sigs) {
    doc.moveTo(s.x, sigY).lineTo(s.x + sigW, sigY).strokeColor('#0f3460').lineWidth(0.7).stroke();
    doc.fillColor('#0f3460').fontSize(7).font('Helvetica-Bold');
    doc.text(s.role, s.x, sigY + 4, { width: sigW, align: 'center', characterSpacing: 0.5 });
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
    doc.text(s.name || '________________', s.x, sigY + 16, { width: sigW, align: 'center' });
  }

  // ==================== SEAL (BELOW signatures, centered) ====================
  const sealCenterX = centerX;
  const sealCenterY = pageH - 55;
  const sealRadius = 38;
  drawSeal(doc, sealCenterX, sealCenterY, sealRadius);

  // ==================== FOOTER ====================
  doc.font('Helvetica-Oblique').fontSize(5.5).fillColor('#94a3b8');
  doc.text(
    'This is a computer-generated certificate. Retain for your records.',
    0, pageH - 12, { align: 'center', width: pageW }
  );

  doc.end();
}

module.exports = { generateShareCertificatePDF };