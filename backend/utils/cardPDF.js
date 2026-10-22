const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');
const Member = require('../models/Member');
const { getLeaderSignature } = require('./leaderHelper');

function setPdfHeaders(res, filename) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function decodeImage(dataUrl) {
  if (!dataUrl || !dataUrl.includes('base64')) return null;
  try { return Buffer.from(dataUrl.split(',')[1], 'base64'); } catch { return null; }
}

// ==================== HELPERS ====================
async function resolvePhoto(card, memberId, directPhoto) {
  let buf = decodeImage(directPhoto);
  if (buf) return buf;
  if (memberId) {
    try {
      const m = await Member.findById(memberId);
      return decodeImage(m?.photo);
    } catch {}
  }
  return null;
}

function drawCircularPhoto(doc, photoBuf, cx, cy, radius, borderColor, fallbackInitials = '?', fallbackColor = '#dcfce7', textColor = '#15803d') {
  if (photoBuf) {
    doc.save();
    doc.circle(cx, cy, radius).clip();
    doc.image(photoBuf, cx - radius, cy - radius, { fit: [radius * 2, radius * 2] });
    doc.restore();
    doc.circle(cx, cy, radius).strokeColor(borderColor).lineWidth(3).stroke();
  } else {
    doc.circle(cx, cy, radius).fill(fallbackColor).strokeColor(borderColor).lineWidth(3).stroke();
    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(radius * 0.6);
    doc.text(fallbackInitials, cx - radius, cy - radius * 0.35, { width: radius * 2, align: 'center' });
  }
}

function drawContributionBox(doc, amount, y, W, colors) {
  if (!amount) return y;
  const boxH = 60;
  const boxX = 100;
  const boxW = W - 200;

  doc.rect(boxX, y, boxW, boxH).fill(colors.bg).strokeColor(colors.primary).lineWidth(1.5).stroke();

  doc.fillColor(colors.subtext).font('Helvetica-Bold').fontSize(9);
  doc.text('CLUB CONTRIBUTION', boxX, y + 10, { width: boxW, align: 'center', characterSpacing: 1.5 });

  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(24);
  doc.text(`UGX ${Number(amount).toLocaleString()}`, boxX, y + 26, { width: boxW, align: 'center' });

  return y + boxH + 15;
}

async function drawCardSigs(doc, requestedSigs, y, colors) {
  if (!requestedSigs || requestedSigs.length === 0) return;
  const W = doc.page.width;
  const M = 60;
  const contentW = W - M * 2;
  const numSigs = requestedSigs.length;
  const spacing = 20;
  const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;

  for (let i = 0; i < numSigs; i++) {
    const role = requestedSigs[i];
    const x = M + i * (sigW + spacing);
    const leader = await Leader.findOne({ role, active: true });
    const sigBuf = await getLeaderSignature(role);

    if (sigBuf) {
      try { doc.image(sigBuf, x + sigW * 0.15, y - 24, { fit: [sigW * 0.7, 22], align: 'center', valign: 'bottom' }); } catch {}
    }

    doc.moveTo(x + sigW * 0.15, y).lineTo(x + sigW * 0.85, y)
      .strokeColor(colors.primary).lineWidth(0.8).stroke();

    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9);
    doc.text(leader?.name || '____________', x, y + 5, { width: sigW, align: 'center' });

    doc.font('Helvetica').fillColor(colors.subtext).fontSize(7);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, y + 19, { width: sigW, align: 'center', characterSpacing: 0.5 });
  }
}

// ==================== INVITATION ====================
async function drawInvitation(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 40;
  const NAVY = '#0f3460', GOLD = '#c9a227', CREAM = '#fef9f3', DARK = '#1e293b', SUB = '#64748b';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(CREAM);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(GOLD).lineWidth(2.5).stroke();
  doc.rect(M + 8, M + 8, W - (M + 8) * 2, H - (M + 8) * 2).strokeColor(GOLD).lineWidth(0.8).stroke();

  const corner = (cx, cy) => {
    doc.moveTo(cx, cy - 9).lineTo(cx + 9, cy).lineTo(cx, cy + 9).lineTo(cx - 9, cy).closePath().fill(GOLD);
  };
  corner(M + 8, M + 8); corner(W - M - 8, M + 8);
  corner(M + 8, H - M - 8); corner(W - M - 8, H - M - 8);

  const topY = M + 50;
  doc.moveTo(W / 2 - 55, topY).lineTo(W / 2 - 12, topY).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.moveTo(W / 2 + 12, topY).lineTo(W / 2 + 55, topY).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.circle(W / 2, topY, 6).fill(GOLD);

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M + 20, M + 65, { width: W - M * 2 - 40, align: 'center', characterSpacing: 1.2 });
  if (profile.tagline) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(SUB);
    doc.text(profile.tagline, M + 20, doc.y + 2, { width: W - M * 2 - 40, align: 'center' });
  }

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(38);
  doc.text('INVITATION', M, 185, { width: W - M * 2, align: 'center', characterSpacing: 6 });

  doc.font('Helvetica-Oblique').fontSize(12).fillColor(SUB);
  doc.text('You are cordially invited to attend', M, 245, { width: W - M * 2, align: 'center' });

  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(22);
  doc.text((d.eventTitle || card.subject || 'GENERAL ASSEMBLY').toUpperCase(), M + 40, 285, { width: W - M * 2 - 80, align: 'center', characterSpacing: 2 });

  const boxY = 355, boxH = 240;
  doc.rect(M + 60, boxY, W - (M + 60) * 2, boxH).fill('#fff').strokeColor(GOLD).lineWidth(1).stroke();

  let dy = boxY + 22;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(10).text(label, M + 90, dy);
    doc.fillColor(DARK).font('Helvetica').fontSize(11).text(value, M + 220, dy, { width: W - (M + 220) - 90 });
    dy += 26;
  };
  row('DATE', d.eventDate ? fmtDate(d.eventDate) : '');
  row('TIME', d.eventTime || '');
  row('VENUE', d.eventVenue || '');
  if (d.dressCode) row('DRESS CODE', d.dressCode);
  if (d.agenda) row('AGENDA', d.agenda);

  if (d.message) {
    doc.fillColor(DARK).font('Helvetica-Oblique').fontSize(11);
    doc.text(d.message, M + 60, boxY + boxH + 20, { width: W - M * 2 - 120, align: 'center', lineGap: 4 });
  }

  if (d.rsvpContact) {
    doc.fillColor(SUB).font('Helvetica').fontSize(10);
    doc.text(`Kindly RSVP to ${d.rsvpContact}`, M, H - 160, { width: W - M * 2, align: 'center' });
  }

  await drawCardSigs(doc, sigs, H - 120, { primary: NAVY, subtext: SUB });

  const botY = H - M - 40;
  doc.moveTo(W / 2 - 55, botY).lineTo(W / 2 - 12, botY).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.moveTo(W / 2 + 12, botY).lineTo(W / 2 + 55, botY).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.circle(W / 2, botY, 6).fill(GOLD);
}

// ==================== SUCCESS ====================
async function drawSuccess(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 40;
  const GREEN = '#15803d', GOLD = '#c9a227', BG = '#f0fdf4', DARK = '#14532d', SUB = '#166534';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(GOLD).lineWidth(2.5).stroke();
  doc.rect(M + 8, M + 8, W - (M + 8) * 2, H - (M + 8) * 2).strokeColor(GREEN).lineWidth(0.8).stroke();

  doc.rect(M + 8, M + 8, W - (M + 8) * 2, 65).fill(GREEN);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(26);
  doc.text('CONGRATULATIONS', 0, M + 28, { width: W, align: 'center', characterSpacing: 3 });

  const photoY = 175, photoD = 140, photoX = M + 60;
  const nameX = photoX + photoD + 30;
  const nameW = W - nameX - M - 40;

  const photoBuf = await resolvePhoto(card, card.memberId, d.candidatePhoto);
  const initials = (d.candidateName || card.subjectPerson?.fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  drawCircularPhoto(doc, photoBuf, photoX + photoD / 2, photoY + photoD / 2, photoD / 2, GOLD, initials, '#dcfce7', GREEN);

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(24);
  doc.text((d.candidateName || card.subjectPerson?.fullName || 'CANDIDATE').toUpperCase(), nameX, photoY + 30, { width: nameW });

  if (d.examName) {
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(13);
    doc.text(d.examName.toUpperCase(), nameX, doc.y + 6, { width: nameW });
  }
  if (d.schoolName) {
    doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(11);
    doc.text(d.schoolName, nameX, doc.y + 4, { width: nameW });
  }
  if (d.resultDetails) {
    doc.fillColor(SUB).font('Helvetica').fontSize(10);
    doc.text(d.resultDetails, nameX, doc.y + 8, { width: nameW });
  }

  const divY = photoY + photoD + 30;
  doc.moveTo(M + 60, divY).lineTo(W - M - 60, divY).strokeColor(GOLD).lineWidth(1.5).stroke();

  doc.fillColor(DARK).font('Helvetica').fontSize(12);
  doc.text(d.message || '', M + 60, divY + 25, { width: W - M * 2 - 120, align: 'justify', lineGap: 5 });

  let cy = doc.y + 20;
  cy = drawContributionBox(doc, d.contributionAmount, cy, W, { bg: '#ecfdf5', primary: GREEN, subtext: SUB });

  await drawCardSigs(doc, sigs, Math.max(cy + 60, H - 130), { primary: GREEN, subtext: SUB });

  doc.fillColor(SUB).font('Helvetica').fontSize(8);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M, H - M - 25, { width: W - M * 2, align: 'center', characterSpacing: 0.6 });
}

// ==================== WEDDING ====================
async function drawWedding(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 40;
  const ROSE = '#be185d', GOLD = '#c9a227', BG = '#fdf4f7', DARK = '#831843', SUB = '#9d174d';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(GOLD).lineWidth(2.5).stroke();
  doc.rect(M + 8, M + 8, W - (M + 8) * 2, H - (M + 8) * 2).strokeColor(ROSE).lineWidth(0.8).stroke();

  const topY = M + 50;
  const drawHeart = (cx, cy, s, color) => {
    doc.save();
    doc.moveTo(cx, cy + s * 0.3)
      .bezierCurveTo(cx + s, cy - s * 0.3, cx + s, cy + s * 0.7, cx, cy + s * 1.3)
      .bezierCurveTo(cx - s, cy + s * 0.7, cx - s, cy - s * 0.3, cx, cy + s * 0.3)
      .fill(color);
    doc.restore();
  };
  drawHeart(W / 2 - 18, topY - 8, 8, ROSE);
  drawHeart(W / 2 + 18, topY - 8, 8, GOLD);

  doc.fillColor(ROSE).font('Helvetica-Bold').fontSize(12);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M, topY + 20, { width: W - M * 2, align: 'center', characterSpacing: 1 });

  doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(11);
  doc.text('Together with their families', M, topY + 50, { width: W - M * 2, align: 'center' });

  // Optional couple photo
  const photoBuf = await resolvePhoto(card, card.memberId, d.couplePhoto);
  const hasPhoto = !!photoBuf;
  const photoR = 50;
  const photoCy = 200;

  if (hasPhoto) {
    drawCircularPhoto(doc, photoBuf, W / 2, photoCy, photoR, GOLD, '', '#fdf4f7', ROSE);
  }

  const namesY = hasPhoto ? photoCy + photoR + 15 : 180;

  doc.fillColor(ROSE).font('Helvetica-Bold').fontSize(28);
  doc.text((d.groomName || 'GROOM').toUpperCase(), M, namesY, { width: W - M * 2, align: 'center', characterSpacing: 2 });
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(30);
  doc.text('&', M, namesY + 45, { width: W - M * 2, align: 'center' });
  doc.fillColor(ROSE).font('Helvetica-Bold').fontSize(28);
  doc.text((d.brideName || 'BRIDE').toUpperCase(), M, namesY + 90, { width: W - M * 2, align: 'center', characterSpacing: 2 });

  doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(11);
  doc.text('request the pleasure of your company at their wedding ceremony', M + 60, namesY + 155, { width: W - M * 2 - 120, align: 'center' });

  const boxY = namesY + 195, boxH = 190;
  doc.rect(M + 60, boxY, W - (M + 60) * 2, boxH).fill('#fff').strokeColor(GOLD).lineWidth(1).stroke();

  let dy = boxY + 22;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(10).text(label, M + 90, dy);
    doc.fillColor(DARK).font('Helvetica').fontSize(11).text(value, M + 220, dy, { width: W - (M + 220) - 90 });
    dy += 26;
  };
  row('DATE', d.weddingDate ? fmtDate(d.weddingDate) : '');
  row('TIME', d.weddingTime || '');
  row('VENUE', d.weddingVenue || '');
  if (d.receptionVenue) row('RECEPTION', d.receptionVenue);
  if (d.dressCode) row('DRESS CODE', d.dressCode);

  let cy = boxY + boxH + 15;

  if (d.message) {
    doc.fillColor(DARK).font('Helvetica').fontSize(11);
    doc.text(d.message, M + 60, cy, { width: W - M * 2 - 120, align: 'justify', lineGap: 4 });
    cy = doc.y + 15;
  }

  cy = drawContributionBox(doc, d.contributionAmount, cy, W, { bg: '#fdf2f8', primary: ROSE, subtext: SUB });

  await drawCardSigs(doc, sigs, Math.max(cy + 50, H - 130), { primary: ROSE, subtext: SUB });
}

// ==================== INTRODUCTION ====================
async function drawIntroduction(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 40;
  const BROWN = '#78350f', AMBER = '#d97706', BG = '#fef9e7', DARK = '#451a03', SUB = '#92400e';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(BROWN).lineWidth(3).stroke();
  doc.rect(M + 8, M + 8, W - (M + 8) * 2, H - (M + 8) * 2).strokeColor(AMBER).lineWidth(1).stroke();

  const bandY = M + 50;
  for (let i = 0; i < 15; i++) {
    const x = M + 30 + i * 35;
    doc.moveTo(x, bandY - 5).lineTo(x + 17, bandY + 3).lineTo(x + 35, bandY - 5).strokeColor(AMBER).lineWidth(1.2).stroke();
  }

  doc.fillColor(BROWN).font('Helvetica-Bold').fontSize(13);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M + 20, M + 75, { width: W - M * 2 - 40, align: 'center', characterSpacing: 1.2 });

  const photoBuf = await resolvePhoto(card, card.memberId, d.couplePhoto);
  const hasPhoto = !!photoBuf;
  const photoR = 48;
  const photoCy = 175;

  if (hasPhoto) {
    drawCircularPhoto(doc, photoBuf, W / 2, photoCy, photoR, AMBER, '', '#fef9e7', BROWN);
  }

  const namesY = hasPhoto ? photoCy + photoR + 12 : 160;

  doc.fillColor(BROWN).font('Helvetica-Bold').fontSize(15);
  doc.text('INTRODUCTION CEREMONY', M, namesY, { width: W - M * 2, align: 'center', characterSpacing: 4 });

  doc.fillColor(AMBER).font('Helvetica-Oblique').fontSize(11);
  doc.text('of', M, namesY + 35, { width: W - M * 2, align: 'center' });

  doc.fillColor(BROWN).font('Helvetica-Bold').fontSize(26);
  doc.text((d.groomName || 'GROOM').toUpperCase(), M, namesY + 70, { width: W - M * 2, align: 'center', characterSpacing: 2 });
  doc.fillColor(AMBER).font('Helvetica-Bold').fontSize(28);
  doc.text('&', M, namesY + 110, { width: W - M * 2, align: 'center' });
  doc.fillColor(BROWN).font('Helvetica-Bold').fontSize(26);
  doc.text((d.brideName || 'BRIDE').toUpperCase(), M, namesY + 150, { width: W - M * 2, align: 'center', characterSpacing: 2 });

  if (d.families) {
    doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(11);
    doc.text(d.families, M + 60, namesY + 200, { width: W - M * 2 - 120, align: 'center' });
  }

  const boxY = namesY + 240, boxH = 155;
  doc.rect(M + 60, boxY, W - (M + 60) * 2, boxH).fill('#fff').strokeColor(AMBER).lineWidth(1).stroke();

  let dy = boxY + 22;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(10).text(label, M + 90, dy);
    doc.fillColor(DARK).font('Helvetica').fontSize(11).text(value, M + 220, dy, { width: W - (M + 220) - 90 });
    dy += 26;
  };
  row('DATE', d.introductionDate ? fmtDate(d.introductionDate) : '');
  row('VENUE', d.introductionVenue || '');
  if (d.dressCode) row('DRESS CODE', d.dressCode);

  let cy = boxY + boxH + 12;

  if (d.message) {
    doc.fillColor(DARK).font('Helvetica').fontSize(10);
    doc.text(d.message, M + 60, cy, { width: W - M * 2 - 120, align: 'justify', lineGap: 4 });
    cy = doc.y + 12;
  }

  cy = drawContributionBox(doc, d.contributionAmount, cy, W, { bg: '#fffbeb', primary: BROWN, subtext: SUB });

  await drawCardSigs(doc, sigs, Math.max(cy + 50, H - 120), { primary: BROWN, subtext: SUB });
}

// ==================== CONDOLENCE ====================
async function drawCondolence(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 40;
  const INK = '#1e293b', GOLD = '#94a3b8', BG = '#fafaf7', DARK = '#0f172a', SUB = '#475569';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(INK).lineWidth(3).stroke();
  doc.rect(M + 10, M + 10, W - (M + 10) * 2, H - (M + 10) * 2).strokeColor(GOLD).lineWidth(0.8).stroke();

  const symY = 95;
  doc.moveTo(W / 2, symY).lineTo(W / 2, symY + 40).strokeColor(INK).lineWidth(2.5).stroke();
  doc.moveTo(W / 2 - 15, symY + 15).lineTo(W / 2 + 15, symY + 15).strokeColor(INK).lineWidth(2.5).stroke();

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M, 155, { width: W - M * 2, align: 'center', characterSpacing: 1 });

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(24);
  doc.text(d.title || 'IN LOVING MEMORY', M, 195, { width: W - M * 2, align: 'center', characterSpacing: 4 });

  // Photo (deceased) — only if provided
  const photoBuf = await resolvePhoto(card, card.memberId, d.deceasedPhoto);
  const hasPhoto = !!photoBuf;
  let afterPhotoY = 245;

  if (hasPhoto) {
    const photoR = 55;
    const photoCy = 290;
    drawCircularPhoto(doc, photoBuf, W / 2, photoCy, photoR, GOLD, '', '#e2e8f0', INK);
    afterPhotoY = photoCy + photoR + 15;
  }

  if (d.deceasedName) {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20);
    doc.text(d.deceasedName.toUpperCase(), M, afterPhotoY, { width: W - M * 2, align: 'center', characterSpacing: 1.5 });
    afterPhotoY = doc.y + 6;
  }
  if (d.lifeDates) {
    doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(12);
    doc.text(d.lifeDates, M, afterPhotoY, { width: W - M * 2, align: 'center' });
    afterPhotoY = doc.y + 6;
  }

  const divY = afterPhotoY + 15;
  doc.moveTo(W / 2 - 90, divY).lineTo(W / 2 + 90, divY).strokeColor(GOLD).lineWidth(1).stroke();

  doc.fillColor(INK).font('Helvetica').fontSize(12);
  doc.text(d.message || '', M + 70, divY + 25, { width: W - M * 2 - 140, align: 'justify', lineGap: 6 });

  let cy = doc.y + 15;
  cy = drawContributionBox(doc, d.contributionAmount, cy, W, { bg: '#f1f5f9', primary: INK, subtext: SUB });

  await drawCardSigs(doc, sigs, Math.max(cy + 50, H - 130), { primary: INK, subtext: SUB });

  doc.moveTo(M + 20, H - M - 25).lineTo(W - M - 20, H - M - 25).strokeColor(GOLD).lineWidth(0.5).stroke();
}

// ==================== MAIN ====================
async function generateCardPDF(card, res, requestedSigs = []) {
  try {
    setPdfHeaders(res, (card.referenceNumber || 'card').replace(/\//g, '-'));
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    doc.pipe(res);
    const profile = (await ClubProfile.findOne()) || {};

    switch (card.type) {
      case 'invitation': await drawInvitation(doc, card, profile, requestedSigs); break;
      case 'success': await drawSuccess(doc, card, profile, requestedSigs); break;
      case 'wedding': await drawWedding(doc, card, profile, requestedSigs); break;
      case 'introduction': await drawIntroduction(doc, card, profile, requestedSigs); break;
      case 'condolence': await drawCondolence(doc, card, profile, requestedSigs); break;
      default: throw new Error('Unknown card type: ' + card.type);
    }
    doc.end();
  } catch (err) {
    console.error('generateCardPDF:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

module.exports = { generateCardPDF };