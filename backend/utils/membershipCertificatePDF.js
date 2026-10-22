const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ClubProfile = require('../models/ClubProfile');
const { getLeaderSignature } = require('./leaderHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

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
    let rotDeg = !isBottom ? (angle * 180 / Math.PI) - 270 : 90 - (angle * 180 / Math.PI);
    doc.save();
    doc.translate(x, y);
    doc.rotate(rotDeg);
    doc.text(char, 0, -fontSize / 3, { lineBreak: false });
    doc.restore();
  });
}

function drawStar(doc, cx, cy, size, color) {
  const outer = size, inner = size * 0.45;
  doc.save();
  doc.fillColor(color);
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    if (i === 0) doc.moveTo(x, y); else doc.lineTo(x, y);
  }
  doc.closePath().fill();
  doc.restore();
}

function drawSeal(doc, cx, cy, r) {
  doc.circle(cx, cy, r).strokeColor('#c9a227').lineWidth(2.2).stroke();
  doc.circle(cx, cy, r - 3).strokeColor('#c9a227').lineWidth(0.6).stroke();
  doc.circle(cx, cy, r - 7).strokeColor('#0f3460').lineWidth(0.5).stroke();
  doc.circle(cx, cy, r - 9).strokeColor('#c9a227').lineWidth(0.4).stroke();
  const dotCount = 40;
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2;
    doc.circle(cx + (r - 11.5) * Math.cos(angle), cy + (r - 11.5) * Math.sin(angle), 0.55).fill('#c9a227');
  }
  drawArcText(doc, 'CRESTED SS INVESTMENT CLUB', cx, cy, r - 17, 205 * Math.PI / 180, 335 * Math.PI / 180, Math.max(5.5, r * 0.16), '#0f3460', false);
  drawArcText(doc, 'OFFICIAL SEAL', cx, cy, r - 17, 155 * Math.PI / 180, 25 * Math.PI / 180, Math.max(5, r * 0.14), '#c9a227', true);
  const sepLen = r * 0.3;
  doc.moveTo(cx - sepLen - 6, cy).lineTo(cx - 6, cy).strokeColor('#c9a227').lineWidth(0.7).stroke();
  doc.moveTo(cx + 6, cy).lineTo(cx + sepLen + 6, cy).strokeColor('#c9a227').lineWidth(0.7).stroke();
  drawStar(doc, cx, cy, r * 0.22, '#c9a227');
  doc.fillColor('#0f3460').fontSize(Math.max(5.5, r * 0.13)).font('Helvetica-Bold');
  doc.text('SACCO', cx - 30, cy + 12, { width: 60, align: 'center' });
}

function drawLogo(doc, logoDataUrl, x, y, maxW, maxH) {
  if (!logoDataUrl || typeof logoDataUrl !== 'string' || !logoDataUrl.startsWith('data:image')) return false;
  try {
    const buf = Buffer.from(logoDataUrl.split(',')[1], 'base64');
    doc.image(buf, x, y, { fit: [maxW, maxH], align: 'center', valign: 'center' });
    return true;
  } catch (e) { return false; }
}

async function generateMembershipCertificatePDF(cert, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${cert.certificateNumber}.pdf`);
  doc.pipe(res);

  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  
  // Dynamically fetch signatures
  const treasurerSig = await getLeaderSignature('treasurer');
  const secretarySig = await getLeaderSignature('secretary');
  const presidentSig = await getLeaderSignature('president');

  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const clubTagline = profile.tagline || 'STRENGTHEN WEALTH';

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const centerX = pageW / 2;

  doc.rect(0, 0, pageW, pageH).fill('#0f3460');
  doc.rect(10, 10, pageW - 20, pageH - 20).fill('#fdfcf7');
  doc.rect(18, 18, pageW - 36, pageH - 36).strokeColor('#c9a227').lineWidth(3).stroke();
  doc.rect(24, 24, pageW - 48, pageH - 48).strokeColor('#0f3460').lineWidth(0.8).stroke();
  doc.rect(28, 28, pageW - 56, pageH - 56).strokeColor('#c9a227').lineWidth(0.5).stroke();

  const cornerSize = 30;
  const corners = [
    { x: 24, y: 24, dx: 1, dy: 1 },
    { x: pageW - 24, y: 24, dx: -1, dy: 1 },
    { x: 24, y: pageH - 24, dx: 1, dy: -1 },
    { x: pageW - 24, y: pageH - 24, dx: -1, dy: -1 }
  ];
  for (const c of corners) {
    doc.moveTo(c.x, c.y + c.dy * cornerSize).lineTo(c.x, c.y).lineTo(c.x + c.dx * cornerSize, c.y).strokeColor('#c9a227').lineWidth(2).stroke();
    doc.moveTo(c.x + c.dx * 6, c.y + c.dy * 6).lineTo(c.x + c.dx * (cornerSize - 6), c.y + c.dy * 6).strokeColor('#c9a227').lineWidth(0.5).stroke();
    doc.moveTo(c.x + c.dx * 6, c.y + c.dy * 6).lineTo(c.x + c.dx * 6, c.y + c.dy * (cornerSize - 6)).strokeColor('#c9a227').lineWidth(0.5).stroke();
  }

  doc.save();
  doc.fillColor('#0f3460').fillOpacity(0.05).font('Helvetica-Bold');
  doc.fontSize(72).text(String(cert.memberName || '').toUpperCase(), 0, 250, { align: 'center', width: pageW });
  doc.fontSize(42).text(String(cert.memberNumber || ''), 0, 335, { align: 'center', width: pageW });
  doc.restore();

  const logoMaxW = 90, logoMaxH = 90;
  const logoX = 55, logoY = 75;
  drawLogo(doc, profile.logo, logoX, logoY, logoMaxW, logoMaxH);

  doc.font('Helvetica').fontSize(9).fillColor('#94a3b8');
  doc.text('Certificate No.', pageW - 210, 40, { width: 180, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f3460');
  doc.text(cert.certificateNumber, pageW - 210, 53, { width: 180, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
  doc.text(`Issued ${new Date(cert.issueDate).toLocaleDateString('en-GB')}`, pageW - 210, 70, { width: 180, align: 'right' });

  const textLeft = logoX + logoMaxW + 30;
  const textRight = pageW - 55;
  const textWidth = textRight - textLeft;

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(20);
  doc.text(clubName, textLeft, 78, { width: textWidth, align: 'center' });

  if (clubTagline) {
    doc.font('Helvetica-Oblique').fontSize(13).fillColor('#c9a227');
    doc.text(clubTagline, textLeft, 112, { width: textWidth, align: 'center' });
  }

  const line1Parts = [profile.location, profile.address, profile.postalAddress].filter(Boolean);
  const line1 = line1Parts.join('  •  ');
  if (line1) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text(line1, textLeft, 136, { width: textWidth, align: 'center' });
  }

  const line2Parts = [profile.contact, profile.email, profile.website].filter(Boolean);
  const line2 = line2Parts.join('  •  ');
  if (line2) {
    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text(line2, textLeft, 150, { width: textWidth, align: 'center' });
  }

  const regParts = [];
  if (profile.registrationNumber) regParts.push(`Reg. No: ${profile.registrationNumber}`);
  if (profile.tin) regParts.push(`TIN: ${profile.tin}`);
  if (regParts.length > 0) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f3460');
    doc.text(regParts.join('     •     '), textLeft, 166, { width: textWidth, align: 'center' });
  }

  doc.moveTo(centerX - 210, 200).lineTo(centerX + 210, 200).strokeColor('#c9a227').lineWidth(1.2).stroke();
  doc.fillColor('#c9a227').fontSize(34).font('Helvetica-Bold');
  doc.text('MEMBERSHIP CERTIFICATE', 0, 210, { align: 'center', width: pageW, characterSpacing: 2 });
  doc.moveTo(centerX - 210, 256).lineTo(centerX + 210, 256).strokeColor('#c9a227').lineWidth(1.2).stroke();

  doc.fillColor('#475569').fontSize(13).font('Helvetica-Oblique');
  doc.text('This is to certify that', 0, 278, { align: 'center', width: pageW });

  doc.fillColor('#0f3460').fontSize(30).font('Helvetica-Bold');
  doc.text(cert.memberName, 0, 302, { align: 'center', width: pageW - 100 });

  doc.moveTo(centerX - 220, 344).lineTo(centerX + 220, 344).strokeColor('#c9a227').lineWidth(0.8).stroke();

  doc.fillColor('#475569').fontSize(12).font('Helvetica');
  doc.text(`Member Number: ${cert.memberNumber}`, 0, 354, { align: 'center', width: pageW });

  doc.font('Helvetica-Oblique').fontSize(14);
  doc.text('is a registered member of the club for the period', 0, 380, { align: 'center', width: pageW });

  const fromStr = new Date(cert.validFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const toStr = new Date(cert.validTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f3460');
  doc.text(`${fromStr}   to   ${toStr}`, 0, 406, { align: 'center', width: pageW });

  doc.font('Helvetica').fontSize(13).fillColor('#475569');
  doc.text(`Membership Year:  ${cert.year}   ·   Type:  ${cert.membershipType === 'first_time' ? 'First-time' : 'Annual Renewal'}`, 0, 432, { align: 'center', width: pageW });

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f3460');
  doc.text(`Fee Paid:  UGX ${fmt(cert.feePaid)}`, 0, 456, { align: 'center', width: pageW });

  const qrSize = 74, qrX = 55, qrY = pageH - 165;
  try {
    const baseUrl = process.env.PUBLIC_API_URL || 'http://192.168.1.6:5000';
    const qrUrl = `${baseUrl}/api/membership/certificates/verify/${cert.certificateNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: qrSize * 4 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font('Helvetica').fontSize(7).fillColor('#64748b');
    doc.text('Scan to verify', qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
  } catch (e) {}

  const sigY = pageH - 105;
  const sigW = 170;
  const sigs = [
    { role: 'TREASURER', sigBuf: treasurerSig, x: pageW - 620 },
    { role: 'SECRETARY', sigBuf: secretarySig, x: pageW - 420 },
    { role: 'PRESIDENT', sigBuf: presidentSig, x: pageW - 220 }
  ];

  for (const s of sigs) {
    doc.moveTo(s.x, sigY).lineTo(s.x + sigW, sigY).strokeColor('#0f3460').lineWidth(0.8).stroke();
    if (s.sigBuf) {
      try {
        doc.image(s.sigBuf, s.x, sigY - 18, { fit: [sigW, 16], align: 'center', valign: 'bottom' });
      } catch (e) {}
    }
    doc.fillColor('#0f3460').fontSize(9).font('Helvetica-Bold');
    doc.text(s.role, s.x, sigY + 5, { width: sigW, align: 'center', characterSpacing: 0.8 });
  }

  drawSeal(doc, centerX, pageH - 45, 40);

  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94a3b8');
  doc.text('This is a computer-generated certificate. Retain for your records.', 0, pageH - 10, { align: 'center', width: pageW });

  doc.end();
}

module.exports = { generateMembershipCertificatePDF };