const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const ClubProfile = require('../models/ClubProfile');
const { getLeaderSignature } = require('./leaderHelper');

const CARD_W = 242.6;
const CARD_H = 153.1;

function signCard(memberId) {
  const secret = process.env.CARD_HMAC_SECRET || 'pesaflow-card-secret-change-me';
  return crypto.createHmac('sha256', secret).update(String(memberId)).digest('hex').slice(0, 12).toUpperCase();
}

function imageBuffer(photo) {
  if (!photo || typeof photo !== 'string') return null;
  if (!photo.startsWith('data:image')) return null;
  try { return Buffer.from(photo.split(',')[1], 'base64'); } catch { return null; }
}

async function generateMemberCardPDF(member, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=card-${member.memberNumber}.pdf`);
  doc.pipe(res);

  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};
  
  // Fetch dynamic signatures
  const presidentSig = await getLeaderSignature('president');
  const treasurerSig = await getLeaderSignature('treasurer');

  const clubName = (profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase();
  const tagline = profile.tagline || '';
  const addressLine = [profile.location, profile.address, profile.postalAddress].filter(Boolean).join(', ');
  const contactLine = [profile.contact, profile.email, profile.website].filter(Boolean).join('  •  ');

  const logoBuf = imageBuffer(profile.logo);
  const photo = imageBuffer(member.photo);

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const padX = (pageW - CARD_W * 2 - 50) / 2;
  const frontX = padX;
  const backX = padX + CARD_W + 50;
  const cardY = 70;

  const securityCode = signCard(member._id);
  const frontendBase = process.env.PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendBase}/verify/card/${member._id}?sig=${securityCode}`;

  // ============================================================
  // ==================== FRONT OF CARD =========================
  // ============================================================

  doc.rect(frontX, cardY, CARD_W, CARD_H).fill('#2c5f9a');

  if (photo) {
    try {
      doc.save();
      doc.rect(frontX, cardY, CARD_W, CARD_H).clip();
      doc.fillOpacity(0.10);
      const wmSize = CARD_W;
      const wmX = frontX;
      const wmY = cardY + CARD_H / 2 - wmSize / 2;
      doc.image(photo, wmX, wmY, { fit: [wmSize, wmSize], align: 'center', valign: 'center' });
      doc.restore();
    } catch (e) { console.error('Card watermark error:', e.message); }
  }

  doc.rect(frontX, cardY, CARD_W, 3).fill('#c9a227');
  doc.rect(frontX, cardY + CARD_H - 3, CARD_W, 3).fill('#c9a227');
  doc.rect(frontX, cardY, CARD_W, CARD_H).strokeColor('#c9a227').lineWidth(1).stroke();

  // ============ HEADER BAND ============
  doc.rect(frontX, cardY + 3, CARD_W, 32).fill('#c9a227');

  const logoSize = 22;
  const logoBoxX = frontX + 6;
  const logoBoxY = cardY + 8;
  const logoCX = logoBoxX + logoSize / 2;
  const logoCY = logoBoxY + logoSize / 2;

  if (logoBuf) {
    doc.circle(logoCX, logoCY, logoSize / 2 + 2).fill('#ffffff');
    doc.circle(logoCX, logoCY, logoSize / 2 + 2).strokeColor('#0f3460').lineWidth(0.6).stroke();
    try {
      doc.image(logoBuf, logoBoxX, logoBoxY, { fit: [logoSize, logoSize], align: 'center', valign: 'center' });
    } catch (e) { console.error('Card logo error:', e.message); }
  }

  const textLeft = logoBoxX + logoSize + 8;
  const textWidth = frontX + CARD_W - textLeft - 6;

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(7);
  doc.text(clubName, textLeft, cardY + 8, { width: textWidth, lineBreak: false, ellipsis: true });

  if (tagline) {
    doc.fillColor('#0f3460').font('Helvetica-Oblique').fontSize(5.5);
    doc.text(tagline.toUpperCase(), logoBoxX, cardY + 22, { width: CARD_W - 12, align: 'center', characterSpacing: 0.8 });
  }

  // ============ PHOTO ============
  const photoSize = 62;
  const photoCX = frontX + 10 + photoSize / 2;
  const photoCY = cardY + 68;

  doc.circle(photoCX, photoCY, photoSize / 2 + 3).fill('#ffffff');
  doc.circle(photoCX, photoCY, photoSize / 2 + 3).strokeColor('#c9a227').lineWidth(1.2).stroke();
  doc.circle(photoCX, photoCY, photoSize / 2).fill('#e2e8f0');

  if (photo) {
    try {
      doc.save();
      doc.circle(photoCX, photoCY, photoSize / 2).clip();
      doc.image(photo, photoCX - photoSize / 2, photoCY - photoSize / 2, {
        cover: [photoSize, photoSize],
        align: 'center',
        valign: 'center'
      });
      doc.restore();
      doc.circle(photoCX, photoCY, photoSize / 2).strokeColor('#c9a227').lineWidth(1.2).stroke();
    } catch (e) {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7);
      doc.text('PHOTO', photoCX - photoSize / 2, photoCY - 3, { width: photoSize, align: 'center' });
    }
  } else {
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7);
    doc.text('PHOTO', photoCX - photoSize / 2, photoCY - 3, { width: photoSize, align: 'center' });
  }

  // ============ MEMBER INFO ============
  const infoX = frontX + 10 + photoSize + 14;
  const infoW = frontX + CARD_W - infoX - 10;

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(5.5);
  doc.text('MEMBERSHIP CARD', infoX, cardY + 40, { width: infoW, characterSpacing: 1.2 });

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(5);
  doc.text('MEMBER NAME', infoX, cardY + 52, { width: infoW });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
  doc.text(`${member.firstName} ${member.surname}`.toUpperCase(), infoX, cardY + 58, { width: infoW, lineBreak: false, ellipsis: true });

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(5);
  doc.text('MEMBER NUMBER', infoX, cardY + 74, { width: infoW });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
  doc.text(member.memberNumber, infoX, cardY + 80, { width: infoW });

  const issueDate = new Date();
  const expiry = new Date(issueDate);
  expiry.setFullYear(expiry.getFullYear() + 2);

  const dateY = cardY + 98;
  const colW = infoW / 3;

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(4.5);
  doc.text('JOINED', infoX, dateY, { width: colW });
  doc.text('ISSUED', infoX + colW, dateY, { width: colW });
  doc.text('EXPIRES', infoX + colW * 2, dateY, { width: colW });

  doc.fillColor('#ffffff').font('Helvetica').fontSize(7);
  doc.text(new Date(member.dateOfSubscription).toLocaleDateString('en-GB'), infoX, dateY + 7, { width: colW });
  doc.text(issueDate.toLocaleDateString('en-GB'), infoX + colW, dateY + 7, { width: colW });
  doc.text(expiry.toLocaleDateString('en-GB'), infoX + colW * 2, dateY + 7, { width: colW });

  // ============ SIGNATURES ============
  const sigY = cardY + CARD_H - 22;

  doc.moveTo(frontX + 12, sigY).lineTo(frontX + 90, sigY).strokeColor('#c9a227').lineWidth(0.5).stroke();

  const memberSig = imageBuffer(member.signature);
  if (memberSig) {
    try {
      doc.image(memberSig, frontX + 12, sigY - 11, { fit: [78, 10], align: 'center', valign: 'bottom' });
    } catch (e) { console.error('Card signature error:', e.message); }
  }

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(4.5);
  doc.text('MEMBER SIGNATURE', frontX + 12, sigY + 3, { width: 78, align: 'center' });

  doc.moveTo(frontX + CARD_W - 105, sigY).lineTo(frontX + CARD_W - 12, sigY).strokeColor('#c9a227').lineWidth(0.5).stroke();
  
  if (presidentSig) {
    try {
      doc.image(presidentSig, frontX + CARD_W - 105, sigY - 11, { fit: [93, 10], align: 'center', valign: 'bottom' });
    } catch (e) {}
  }

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(5);
  doc.text('PRESIDENT', frontX + CARD_W - 105, sigY + 3, { width: 93, align: 'center' });

  doc.fillColor('#ffd966').font('Helvetica-Bold').fontSize(4.5);
  doc.text(`SEC: ${securityCode}`, frontX + 12, cardY + CARD_H - 7, { width: 100 });

  const micro = `${member.memberNumber}•PESAFLOW•`.repeat(20);
  doc.fillColor('#ffd966').font('Helvetica').fontSize(2.5).fillOpacity(0.45);
  doc.text(micro, frontX + 2, cardY + CARD_H - 5.5, { width: CARD_W - 4, lineBreak: false });
  doc.fillOpacity(1);

  // ============================================================
  // ==================== BACK OF CARD ==========================
  // ============================================================

  doc.rect(backX, cardY, CARD_W, CARD_H).fill('#e0e8f3');

  if (photo) {
    try {
      doc.save();
      doc.rect(backX, cardY, CARD_W, CARD_H).clip();
      doc.fillOpacity(0.06);
      const wmSize = CARD_W;
      const wmX = backX;
      const wmY = cardY + CARD_H / 2 - wmSize / 2;
      doc.image(photo, wmX, wmY, { fit: [wmSize, wmSize], align: 'center', valign: 'center' });
      doc.restore();
    } catch (e) { console.error('Back watermark error:', e.message); }
  }

  doc.rect(backX, cardY, CARD_W, 16).fill('#c9a227');
  doc.rect(backX, cardY, CARD_W, CARD_H).strokeColor('#c9a227').lineWidth(1).stroke();

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(7);
  doc.text('CLUB OFFICE', backX, cardY + 5, { width: CARD_W, align: 'center', characterSpacing: 0.6 });

  let backY = cardY + 26;

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(5.5);
  doc.text('ADDRESS', backX + 8, backY, { width: CARD_W - 100 });
  backY += 7;
  doc.fillColor('#334155').font('Helvetica').fontSize(5.5);
  if (addressLine) {
    doc.text(addressLine, backX + 8, backY, { width: CARD_W - 100 });
    backY += doc.heightOfString(addressLine, { width: CARD_W - 100 }) + 2;
  }
  if (contactLine) {
    doc.text(contactLine, backX + 8, backY, { width: CARD_W - 100 });
    backY += doc.heightOfString(contactLine, { width: CARD_W - 100 }) + 2;
  }

  backY += 5;
  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(5.5);
  doc.text('IF FOUND, PLEASE RETURN TO:', backX + 8, backY, { width: CARD_W - 100 });
  backY += 7;
  doc.fillColor('#334155').font('Helvetica').fontSize(5);
  doc.text('Any club office branch. Reward upon return.', backX + 8, backY, { width: CARD_W - 100 });

  const backSigY = cardY + CARD_H - 22;
  doc.moveTo(backX + 8, backSigY).lineTo(backX + 90, backSigY).strokeColor('#0f3460').lineWidth(0.5).stroke();
  
  if (treasurerSig) {
    try {
      doc.image(treasurerSig, backX + 8, backSigY - 11, { fit: [82, 10], align: 'center', valign: 'bottom' });
    } catch (e) {}
  }

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(4.5);
  doc.text('TREASURER', backX + 8, backSigY + 2, { width: 82, align: 'center' });

  const qrSize = 72;
  const qrX = backX + CARD_W - qrSize - 12;
  const qrY = cardY + 34;

  doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).fill('#ffffff');
  doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).strokeColor('#c9a227').lineWidth(0.6).stroke();

  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: qrSize * 4, errorCorrectionLevel: 'M' });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(4.5);
    doc.text('SCAN TO VERIFY', qrX - 4, qrY + qrSize + 6, { width: qrSize + 8, align: 'center' });
    doc.fillColor('#64748b').font('Helvetica').fontSize(4);
    doc.text('Authenticity + shares', qrX - 4, qrY + qrSize + 13, { width: qrSize + 8, align: 'center' });
  } catch (e) { console.error('QR error:', e.message); }

  const backMicro = `${securityCode}-${member.memberNumber}•`.repeat(18);
  doc.fillColor('#0f3460').font('Helvetica').fontSize(2.5).fillOpacity(0.45);
  doc.text(backMicro, backX + 2, cardY + CARD_H - 5.5, { width: CARD_W - 4, lineBreak: false });
  doc.fillOpacity(1);

  const drawCrop = (x, y) => {
    doc.moveTo(x - 7, y).lineTo(x - 2, y).strokeColor('#94a3b8').lineWidth(0.3).stroke();
    doc.moveTo(x, y - 7).lineTo(x, y - 2).strokeColor('#94a3b8').lineWidth(0.3).stroke();
  };
  drawCrop(frontX, cardY);
  drawCrop(frontX + CARD_W, cardY);
  drawCrop(frontX, cardY + CARD_H);
  drawCrop(frontX + CARD_W, cardY + CARD_H);
  drawCrop(backX, cardY);
  drawCrop(backX + CARD_W, cardY);
  drawCrop(backX, cardY + CARD_H);
  drawCrop(backX + CARD_W, cardY + CARD_H);

  doc.fillColor('#0f3460').font('Helvetica-Bold').fontSize(11);
  doc.text('CLUB MEMBERSHIP CARD', 0, 25, { align: 'center', width: pageW });
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(7);
  doc.text('Print at 100% scale. Card size: 85.6mm × 54mm.', 0, 42, { align: 'center', width: pageW });

  doc.end();
}

module.exports = { generateMemberCardPDF, signCard };