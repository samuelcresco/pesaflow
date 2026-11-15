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
    doc.circle(cx, cy, radius).strokeColor(borderColor).lineWidth(2).stroke();
  } else {
    doc.circle(cx, cy, radius).fill(fallbackColor).strokeColor(borderColor).lineWidth(2).stroke();
    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(radius * 0.6);
    doc.text(fallbackInitials, cx - radius, cy - radius * 0.35, { width: radius * 2, align: 'center' });
  }
}

async function drawCardSigs(doc, requestedSigs, y, colors) {
  if (!requestedSigs || requestedSigs.length === 0) return;
  const W = doc.page.width;
  const M = 40;
  const contentW = W - M * 2;
  const numSigs = requestedSigs.length;
  const spacing = 10;
  const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;

  for (let i = 0; i < numSigs; i++) {
    const role = requestedSigs[i];
    const x = M + i * (sigW + spacing);
    const leader = await Leader.findOne({ role, active: true });
    const sigBuf = await getLeaderSignature(role);

    if (sigBuf) {
      try { doc.image(sigBuf, x + sigW * 0.15, y - 20, { fit: [sigW * 0.7, 20], align: 'center', valign: 'bottom' }); } catch {}
    }

    doc.moveTo(x + sigW * 0.15, y).lineTo(x + sigW * 0.85, y)
      .strokeColor(colors.primary).lineWidth(0.5).stroke();

    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(8);
    doc.text(leader?.name || '____________', x, y + 4, { width: sigW, align: 'center' });

    doc.font('Helvetica').fillColor(colors.subtext).fontSize(6);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, y + 16, { width: sigW, align: 'center', characterSpacing: 0.5 });
  }
}

// ==================== INVITATION (A5) ====================
async function drawInvitation(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 20; 
  const BG = '#ffffff';
  const PRIMARY = '#0f172a'; 
  const ACCENT = '#b45309'; 
  const SUBTEXT = '#64748b';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(PRIMARY).lineWidth(2).stroke();
  doc.rect(M + 4, M + 4, W - (M + 4) * 2, H - (M + 4) * 2).strokeColor(ACCENT).lineWidth(0.5).stroke();
  doc.rect(M + 4, M + 4, W - (M + 4) * 2, 40).fill(PRIMARY);
  
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M + 10, M + 16, { width: W - (M + 10) * 2, align: 'center', characterSpacing: 1.5 });

  doc.fillColor(ACCENT).font('Times-Italic').fontSize(46);
  doc.text('Invitation', 0, 75, { width: W, align: 'center' });

  doc.font('Helvetica').fontSize(10).fillColor(PRIMARY);
  doc.text('YOU ARE CORDIALLY INVITED TO ATTEND', 0, 130, { width: W, align: 'center', characterSpacing: 2 });

  doc.font('Times-Bold').fontSize(26).fillColor(PRIMARY);
  const eventTitle = (d.eventTitle || card.subject || 'GENERAL ASSEMBLY').toUpperCase();
  doc.text(eventTitle, 30, 160, { width: W - 60, align: 'center' });

  const divY = 200;
  doc.moveTo(60, divY).lineTo(W / 2 - 10, divY).strokeColor(ACCENT).lineWidth(1).stroke();
  doc.moveTo(W / 2 + 10, divY).lineTo(W - 60, divY).strokeColor(ACCENT).lineWidth(1).stroke();
  doc.save();
  doc.translate(W / 2, divY);
  doc.rotate(45);
  doc.rect(-3, -3, 6, 6).fill(ACCENT);
  doc.restore();

  let currentY = 225;
  const row = (label, value) => {
    if (!value) return;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(SUBTEXT).text(label, W / 2 - 100, currentY, { width: 80, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(PRIMARY).text(value, W / 2 + 10, currentY - 1, { width: 200 });
    currentY += 25;
  };
  
  row('DATE:', d.eventDate ? fmtDate(d.eventDate) : '');
  row('TIME:', d.eventTime || '');
  row('VENUE:', d.eventVenue || '');
  
  currentY += 15;

  if (d.message) {
    doc.font('Times-Italic').fontSize(14).fillColor(PRIMARY);
    doc.text(d.message, 50, currentY, { width: W - 100, align: 'center', lineGap: 4 });
    currentY += doc.heightOfString(d.message, { width: W - 100 }) + 20;
  }

  if (d.rsvpContact) {
    doc.font('Helvetica').fontSize(9).fillColor(SUBTEXT).text('KINDLY RSVP', 0, H - 120, { width: W, align: 'center', characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY).text(d.rsvpContact, 0, H - 105, { width: W, align: 'center' });
  }

  await drawCardSigs(doc, sigs, H - 60, { primary: PRIMARY, subtext: SUBTEXT });
}

// ==================== SUCCESS (A5) ====================
async function drawSuccess(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 20;
  const BG = '#f8fafc';
  const PRIMARY = '#064e3b';
  const ACCENT = '#d97706';
  const SUB = '#475569';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(PRIMARY).lineWidth(2).stroke();
  doc.rect(M + 4, M + 4, W - (M + 4) * 2, H - (M + 4) * 2).strokeColor(ACCENT).lineWidth(0.5).stroke();

  doc.rect(M + 4, M + 4, W - (M + 4) * 2, 45).fill(PRIMARY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18);
  doc.text('BEST WISHES', 0, M + 18, { width: W, align: 'center', characterSpacing: 3 });

  const photoY = 90, photoD = 85;
  const photoBuf = await resolvePhoto(card, card.memberId, d.candidatePhoto);
  const initials = (d.candidateName || card.subjectPerson?.fullName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  
  doc.circle(W / 2, photoY + photoD / 2, (photoD / 2) + 4).strokeColor(ACCENT).lineWidth(1.5).stroke();
  drawCircularPhoto(doc, photoBuf, W / 2, photoY + photoD / 2, photoD / 2, PRIMARY, initials, '#dcfce7', PRIMARY);

  let currentY = 195;
  if (d.relationship && d.relationship !== 'self') {
    const memName = card.subjectPerson?.fullName || 'MEMBER';
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(10);
    doc.text(`${memName.toUpperCase()}'S ${d.relationship.toUpperCase()}`, 20, currentY, { width: W - 40, align: 'center', characterSpacing: 1 });
    currentY += 18;
  }

  doc.fillColor(PRIMARY).font('Times-Bold').fontSize(22);
  doc.text((d.candidateName || 'CANDIDATE').toUpperCase(), 20, currentY, { width: W - 40, align: 'center' });

  currentY += 30;
  if (d.examLevel) {
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11);
    doc.text(`SITTING FOR: ${d.examLevel.toUpperCase()}`, 20, currentY, { width: W - 40, align: 'center', characterSpacing: 1 });
    currentY += 20;
  }

  currentY += 10;
  if (d.message) {
    doc.fillColor(PRIMARY).font('Times-Italic').fontSize(13);
    doc.text(d.message, 40, currentY, { width: W - 80, align: 'center', lineGap: 5 });
  }

  await drawCardSigs(doc, sigs, H - 65, { primary: PRIMARY, subtext: SUB });

  doc.fillColor(SUB).font('Helvetica').fontSize(6);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), M, H - M - 15, { width: W - M * 2, align: 'center', characterSpacing: 0.5 });
}

// ==================== WEDDING (A5 Premium) ====================
async function drawWedding(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 20;
  const BG = '#fffafa'; 
  const PRIMARY = '#831843'; 
  const ACCENT = '#c9a227'; 
  const SUB = '#64748b';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(ACCENT).lineWidth(2).stroke();
  doc.rect(M + 5, M + 5, W - (M + 5) * 2, H - (M + 5) * 2).strokeColor(PRIMARY).lineWidth(0.5).stroke();

  // Club Name Header
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), 20, 35, { width: W - 40, align: 'center', characterSpacing: 1.5 });

  // Relationship Tag (e.g. DAUGHTER OF KABENGE SAMUEL)
  let yOffset = 60;
  if (d.weddingRelationship && d.weddingRelationship !== 'self' && d.weddingRelationship !== 'none' && card.subjectPerson?.fullName) {
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(9);
    doc.text(`${d.weddingRelationship.toUpperCase()} OF ${card.subjectPerson.fullName.toUpperCase()}`, 20, yOffset, { width: W - 40, align: 'center', characterSpacing: 1 });
    yOffset += 15;
  }

  const photoBuf = await resolvePhoto(card, card.memberId, d.couplePhoto);
  const hasPhoto = !!photoBuf;
  let namesY = yOffset + 5;
  
  if (hasPhoto) {
    const photoR = 50;
    drawCircularPhoto(doc, photoBuf, W / 2, yOffset + 10 + photoR, photoR, ACCENT, '', '#fdf4f7', PRIMARY);
    namesY = yOffset + 10 + photoR * 2 + 15;
  }

  doc.fillColor(PRIMARY).font('Times-Bold').fontSize(24);
  doc.text((d.groomName || 'GROOM').toUpperCase(), 20, namesY, { width: W - 40, align: 'center' });
  
  doc.fillColor(ACCENT).font('Times-Italic').fontSize(28);
  doc.text('&', 20, namesY + 30, { width: W - 40, align: 'center' });
  
  doc.fillColor(PRIMARY).font('Times-Bold').fontSize(24);
  doc.text((d.brideName || 'BRIDE').toUpperCase(), 20, namesY + 65, { width: W - 40, align: 'center' });

  // Club Pledge / Contribution instead of "request the pleasure..."
  let pledgeText = 'request the pleasure of your company at their wedding ceremony';
  if (d.contributionAmount) {
    pledgeText = `The Club pledges a contribution of UGX ${Number(d.contributionAmount).toLocaleString()} to support this joyous occasion.`;
  }

  doc.fillColor(SUB).font('Helvetica').fontSize(10);
  doc.text(pledgeText, 30, namesY + 105, { width: W - 60, align: 'center' });

  const boxY = namesY + 135;
  doc.rect(40, boxY, W - 80, 115).fill('#ffffff').strokeColor(ACCENT).lineWidth(1).stroke();

  let dy = boxY + 15;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(8).text(label, 55, dy);
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9).text(value, 120, dy, { width: W - 160 });
    dy += 18;
  };
  row('DATE', d.weddingDate ? fmtDate(d.weddingDate) : '');
  row('TIME', d.weddingTime || '');
  row('VENUE', d.weddingVenue || '');
  if (d.receptionVenue) row('RECEPTION', d.receptionVenue);

  let cy = boxY + 130;
  if (d.message) {
    doc.fillColor(PRIMARY).font('Times-Italic').fontSize(11);
    doc.text(d.message, 40, cy, { width: W - 80, align: 'center', lineGap: 3 });
    cy = doc.y + 15;
  }

  await drawCardSigs(doc, sigs, H - 60, { primary: PRIMARY, subtext: SUB });
}

// ==================== INTRODUCTION (A5 Premium) ====================
async function drawIntroduction(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 20;
  const BG = '#fef9e7'; 
  const PRIMARY = '#78350f'; 
  const ACCENT = '#d97706'; 
  const SUB = '#92400e';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);
  
  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(ACCENT).lineWidth(2).stroke();
  doc.rect(M + 5, M + 5, W - (M + 5) * 2, H - (M + 5) * 2).strokeColor(PRIMARY).lineWidth(0.5).stroke();

  // Club Name Header
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9);
  doc.text((profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase(), 20, 35, { width: W - 40, align: 'center', characterSpacing: 1.5 });

  // Relationship Tag
  let yOffset = 60;
  if (d.weddingRelationship && d.weddingRelationship !== 'self' && d.weddingRelationship !== 'none' && card.subjectPerson?.fullName) {
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(9);
    doc.text(`${d.weddingRelationship.toUpperCase()} OF ${card.subjectPerson.fullName.toUpperCase()}`, 20, yOffset, { width: W - 40, align: 'center', characterSpacing: 1 });
    yOffset += 15;
  }

  // Couple Photo
  const photoBuf = await resolvePhoto(card, card.memberId, d.couplePhoto);
  const hasPhoto = !!photoBuf;
  let namesY = yOffset + 5;
  
  if (hasPhoto) {
    const photoR = 45;
    drawCircularPhoto(doc, photoBuf, W / 2, yOffset + 10 + photoR, photoR, ACCENT, '', '#fef9e7', PRIMARY);
    namesY = yOffset + 10 + photoR * 2 + 15;
  }

  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(12);
  doc.text('INTRODUCTION CEREMONY', 20, namesY, { width: W - 40, align: 'center', characterSpacing: 2 });
  namesY += 20;

  // Couple Names
  doc.fillColor(PRIMARY).font('Times-Bold').fontSize(22);
  doc.text((d.groomName || 'GROOM').toUpperCase(), 20, namesY, { width: W - 40, align: 'center' });
  
  doc.fillColor(ACCENT).font('Times-Italic').fontSize(26);
  doc.text('&', 20, namesY + 25, { width: W - 40, align: 'center' });
  
  doc.fillColor(PRIMARY).font('Times-Bold').fontSize(22);
  doc.text((d.brideName || 'BRIDE').toUpperCase(), 20, namesY + 55, { width: W - 40, align: 'center' });

  // Families (Split left and right)
  let familyY = namesY + 90;
  if (d.groomFamily || d.brideFamily) {
    doc.fillColor(SUB).font('Helvetica-Oblique').fontSize(10);
    
    if (d.groomFamily) {
      doc.text(d.groomFamily, 40, familyY, { width: (W / 2) - 50, align: 'right' });
    }
    if (d.brideFamily) {
      doc.text(d.brideFamily, W / 2 + 10, familyY, { width: (W / 2) - 50, align: 'left' });
    }
    
    // "&" in the middle
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10);
    doc.text('&', W / 2 - 10, familyY, { width: 20, align: 'center' });
    
    familyY += 20;
  }

  // Club Pledge
  if (d.contributionAmount) {
    doc.fillColor(SUB).font('Helvetica').fontSize(9);
    doc.text(`The Club pledges a contribution of UGX ${Number(d.contributionAmount).toLocaleString()} to support this joyous occasion.`, 30, familyY, { width: W - 60, align: 'center' });
    familyY += 20;
  }

  const boxY = familyY + 10;
  // Soft faded white box (matching wedding style)
  doc.rect(40, boxY, W - 80, 95).fill('#fffaf0').strokeColor(ACCENT).lineWidth(1).stroke();

  let dy = boxY + 15;
  const row = (label, value) => {
    if (!value) return;
    doc.fillColor(SUB).font('Helvetica-Bold').fontSize(8).text(label, 55, dy);
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9).text(value, 120, dy, { width: W - 160 });
    dy += 18;
  };
  row('DATE', d.introductionDate ? fmtDate(d.introductionDate) : '');
  row('TIME', d.introductionTime || '');
  row('VENUE', d.introductionVenue || '');
  if (d.dressCode) row('DRESS CODE', d.dressCode);

  let cy = boxY + 110;
  if (d.message) {
    doc.fillColor(PRIMARY).font('Times-Italic').fontSize(11);
    doc.text(d.message, 40, cy, { width: W - 80, align: 'center', lineGap: 3 });
  }

  await drawCardSigs(doc, sigs, H - 60, { primary: PRIMARY, subtext: SUB });
}

// ==================== CONDOLENCE (A5 Premium) ====================
async function drawCondolence(doc, card, profile, sigs) {
  const W = doc.page.width, H = doc.page.height;
  const M = 20;
  const BG = '#0a192f';
  const GOLD = '#d4af37';
  const CREAM = '#f8fafc';
  const d = card.cardDetails || {};

  doc.rect(0, 0, W, H).fill(BG);

  doc.rect(M, M, W - M * 2, H - M * 2).strokeColor(GOLD).lineWidth(2).stroke();
  doc.rect(M + 5, M + 5, W - (M + 5) * 2, H - (M + 5) * 2).strokeColor(GOLD).lineWidth(0.5).stroke();

  doc.fillColor(GOLD).font('Times-Roman').fontSize(30);
  doc.text('†', 0, 40, { width: W, align: 'center' });

  doc.fillColor(CREAM).font('Times-Roman').fontSize(12);
  doc.text('With Deep Sorrow We Announce', 0, 85, { width: W, align: 'center' });
  doc.text('The Passing Of', 0, 100, { width: W, align: 'center' });

  doc.fillColor(GOLD).font('Times-Bold').fontSize(20);
  doc.text((d.deceasedName || 'BELOVED MEMBER').toUpperCase(), 20, 125, { width: W - 40, align: 'center' });

  const photoY = 160, photoD = 130;
  const photoBuf = await resolvePhoto(card, card.memberId, d.deceasedPhoto);
  const initials = (d.deceasedName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  
  doc.circle(W / 2, photoY + photoD / 2, (photoD / 2) + 3).strokeColor(GOLD).lineWidth(1).stroke();
  drawCircularPhoto(doc, photoBuf, W / 2, photoY + photoD / 2, photoD / 2, GOLD, initials, BG, CREAM);

  let currentY = 310;
  if (d.lifeDates) {
    doc.fillColor(GOLD).font('Times-Italic').fontSize(14);
    doc.text(d.lifeDates, 20, currentY, { width: W - 40, align: 'center' });
    currentY += 25;
  }

  doc.fillColor(CREAM).font('Times-Bold').fontSize(16);
  doc.text('Rest In Eternal Peace', 20, currentY, { width: W - 40, align: 'center' });
  currentY += 25;

  doc.fillColor(CREAM).font('Times-Roman').fontSize(10);
  if (d.condolenceCase === 'member_lost_loved_one' && d.relativeRelationship) {
    doc.text(`Beloved ${d.relativeRelationship.charAt(0).toUpperCase() + d.relativeRelationship.slice(1)}`, 20, currentY, { width: W - 40, align: 'center' });
  } else {
    doc.text(`Late Member`, 20, currentY, { width: W - 40, align: 'center' });
  }
  currentY += 20;

  if (d.funeralDate) {
    doc.fillColor(GOLD).font('Times-Bold').fontSize(11);
    doc.text(`Burial: ${fmtDate(d.funeralDate)}`, 20, currentY, { width: W - 40, align: 'center' });
    currentY += 16;
  }
  if (d.funeralVenue) {
    doc.fillColor(CREAM).font('Times-Roman').fontSize(10);
    doc.text(`Venue: ${d.funeralVenue}`, 20, currentY, { width: W - 40, align: 'center' });
    currentY += 20;
  }

  doc.moveTo(W / 2 - 60, currentY).lineTo(W / 2 + 60, currentY).strokeColor(GOLD).lineWidth(0.5).stroke();
  currentY += 15;

  if (d.message) {
    doc.fillColor(CREAM).font('Times-Italic').fontSize(10);
    doc.text(d.message, 30, currentY, { width: W - 60, align: 'center', lineGap: 3 });
  }

  await drawCardSigs(doc, sigs, H - 50, { primary: GOLD, subtext: CREAM });
}

// ==================== MAIN ====================
async function generateCardPDF(card, res, requestedSigs = []) {
  try {
    setPdfHeaders(res, (card.referenceNumber || 'card').replace(/\//g, '-'));
    const doc = new PDFDocument({ size: [420, 595], margin: 0 });
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