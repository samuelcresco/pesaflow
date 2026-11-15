const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');
const { getLeaderSignature } = require('./leaderHelper');

// ── Brand Palette ──
const SKY_BLUE = '#0284c7';
const ACCENT = '#e94560';
const GOLD = '#d4af37';
const TEXT_DARK = '#1e293b';
const TEXT_LIGHT = '#64748b';
const LINE_LIGHT = '#e2e8f0';

function setPdfHeaders(res, filename) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getTermDates(letter) {
  const sp = letter.subjectPerson || {};
  const cd = letter.cardDetails || {};
  return {
    start: letter.termStart || sp.termStart || cd.termStart || null,
    end:   letter.termEnd   || sp.termEnd   || cd.termEnd   || null
  };
}

function drawPageFrame(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  doc.rect(0, 0, pageW, 8).fill(SKY_BLUE);
  doc.rect(0, 8, pageW, 2).fill(GOLD);

  doc.rect(20, 20, pageW - 40, pageH - 40)
    .strokeColor(LINE_LIGHT).lineWidth(1).stroke();

  doc.save();
  doc.opacity(0.03);
  doc.fontSize(120).font('Helvetica-Bold').fillColor(SKY_BLUE);
  doc.text('OFFICIAL', 0, pageH / 2 - 60, { width: pageW, align: 'center' });
  doc.restore();
}

function drawLetterhead(doc, profile) {
  const pageW = doc.page.width;
  const bannerH = 140;
  doc.rect(30, 30, pageW - 60, bannerH).fill(SKY_BLUE);
  doc.rect(30, 30 + bannerH - 4, pageW - 60, 4).fill(GOLD);

  let logoSize = 45;
  const hasLogo = profile.logo && profile.logo.includes('base64');
  let topOffset = 30 + 8;

  if (hasLogo) {
    try {
      const logoBuf = Buffer.from(profile.logo.split(',')[1] || '', 'base64');
      if (logoBuf.length) {
        const logoX = (pageW - logoSize) / 2;
        doc.image(logoBuf, logoX, topOffset, { fit: [logoSize, logoSize] });
        topOffset += logoSize + 4;
      }
    } catch (e) { /* ignore */ }
  }

  const name = (profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14);
  doc.text(name, 30, topOffset, { width: pageW - 60, align: 'center', characterSpacing: 0.5 });
  topOffset = doc.y + 3;

  if (profile.tagline) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GOLD);
    doc.text(profile.tagline.toUpperCase(), 30, topOffset, { width: pageW - 60, align: 'center', characterSpacing: 1.5 });
    topOffset = doc.y + 4;
  }

  const contactParts = [profile.contact, profile.email, profile.website].filter(Boolean);
  if (contactParts.length) {
    doc.fontSize(9).font('Helvetica').fillColor('#ffffff');
    doc.text(contactParts.join('   •   '), 30, topOffset, { width: pageW - 60, align: 'center' });
    topOffset = doc.y + 3;
  }

  const bottomParts = [];
  if (profile.postalAddress) bottomParts.push(profile.postalAddress);
  if (profile.location) bottomParts.push(profile.location);
  if (profile.registrationNumber) bottomParts.push(`Reg. No: ${profile.registrationNumber}`);
  if (profile.tin) bottomParts.push(`TIN: ${profile.tin}`);

  if (bottomParts.length) {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#f1f5f9');
    doc.text(bottomParts.join('   |   '), 30, topOffset, { width: pageW - 60, align: 'center' });
  }

  doc.y = 30 + bannerH + 22;
}

function drawLetterBody(doc, letter, profile) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;
  const contentW = pageW - M * 2;

  // Ref + Date
  doc.fontSize(9).font('Helvetica-Bold').fillColor(SKY_BLUE);
  doc.text(`REF: ${letter.referenceNumber}`, M, doc.y);

  doc.fontSize(9).font('Helvetica').fillColor(TEXT_LIGHT);
  doc.text(formatDate(letter.date), M, doc.y - 11, { width: contentW, align: 'right' });
  doc.moveDown(1.4);

  doc.moveTo(M, doc.y).lineTo(pageW - M, doc.y).strokeColor(LINE_LIGHT).lineWidth(0.5).stroke();
  doc.moveDown(1.0);

  // Recipient
  const r = letter.recipient || {};
  if (r.name || r.title || r.organization || r.address) {
    doc.fontSize(10).font('Helvetica').fillColor(TEXT_DARK);
    if (r.name) doc.text(r.name, M, doc.y);
    if (r.title) doc.text(r.title, M, doc.y);
    if (r.organization) doc.text(r.organization, M, doc.y);
    if (r.address) doc.text(r.address, M, doc.y);
    doc.moveDown(1.0);
  }

  if (r.salutation) {
    doc.fontSize(11).font('Helvetica').fillColor(TEXT_DARK);
    doc.text(r.salutation, M, doc.y);
    doc.moveDown(0.8);
  }

  // SUBJECT BAR
  const subjectText = (letter.subject || '').toUpperCase();
  const barY = doc.y;
  const barH = 24;
  doc.rect(M, barY, contentW, barH).fill(SKY_BLUE);
  doc.rect(M, barY, 4, barH).fill(GOLD);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
     .text(subjectText, M + 15, barY + 7, { characterSpacing: 0.5 });
  doc.y = barY + barH + 15;

  // BODY PARAGRAPHS
  const paragraphs = (letter.body || []).filter(Boolean);
  paragraphs.forEach(para => {
    const cleanPara = para.replace(/<\/?strong>/gi, ''); // strip tags safely
    doc.fontSize(11).font('Helvetica').fillColor(TEXT_DARK);
    
    // Increased lineGap to 6 and moveDown to 1.2 for better paragraph spacing
    doc.text(cleanPara, M, doc.y, { width: contentW, align: 'justify', lineGap: 6 });
    doc.moveDown(1.2);
  });

  // TERM SENTENCE (LAST PARAGRAPH)
  const { start, end } = getTermDates(letter);
  if (start || end) {
    const startTxt = formatDate(start) || 'the date of this letter';
    const endTxt   = formatDate(end)   || 'further notice';
    doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK);
    doc.text(
      `Your term in office starts on ${startTxt} and will end on ${endTxt}.`,
      M, doc.y + 4,
      { width: contentW, align: 'justify' }
    );
    doc.moveDown(0.8);
  }

  // Pin closing block
  const closingTarget = pageH - 225;
  if (doc.y < closingTarget) doc.y = closingTarget;

  doc.fontSize(11).font('Helvetica').fillColor(TEXT_DARK);
  doc.text('Yours faithfully,', M, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Oblique').fillColor(TEXT_LIGHT);
  doc.text('For and on behalf of the Shareholders,', M, doc.y);
}

async function drawSignatures(doc, requestedSigs) {
  if (!requestedSigs || requestedSigs.length === 0) return;

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;
  const contentW = pageW - M * 2;
  const numSigs = requestedSigs.length;
  const spacing = 30;

  const stampW = 100;
  const sigAreaW = contentW - stampW - 20;
  const sigW = (sigAreaW - (numSigs - 1) * spacing) / numSigs;

  const lineY = pageH - 160;

  for (let i = 0; i < numSigs; i++) {
    const role = requestedSigs[i];
    const x = M + i * (sigW + spacing);

    const leader = await Leader.findOne({ role, active: true });
    const sigBuffer = await getLeaderSignature(role);

    if (sigBuffer) {
      try {
        doc.image(sigBuffer, x + sigW * 0.1, lineY - 35, {
          fit: [sigW * 0.8, 30], align: 'center', valign: 'bottom'
        });
      } catch (e) { /* ignore */ }
    }

    doc.moveTo(x + sigW * 0.1, lineY)
       .lineTo(x + sigW * 0.9, lineY)
       .strokeColor(TEXT_DARK).lineWidth(1).stroke();

    doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_DARK);
    doc.text(leader?.name || '__________________', x, lineY + 4, {
      width: sigW, align: 'center'
    });

    doc.fontSize(7).font('Helvetica-Bold').fillColor(ACCENT);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, lineY + 17, {
      width: sigW, align: 'center', characterSpacing: 0.8
    });
  }

  // Stamp placeholder
  const stampX = M + contentW - stampW;
  const stampY = lineY - 25;
  const stampH = 60;

  doc.save();
  doc.opacity(0.15);
  doc.rect(stampX, stampY, stampW, stampH)
     .strokeColor(ACCENT).lineWidth(1).dash(3, { space: 3 }).stroke();
  doc.undash();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(ACCENT);
  doc.text('OFFICIAL CLUB', stampX, stampY + 18, { width: stampW, align: 'center' });
  doc.text('STAMP', stampX, stampY + 30, { width: stampW, align: 'center' });
  doc.restore();
}

function drawFooter(doc, profile) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;

  doc.moveTo(M, pageH - 50).lineTo(pageW - M, pageH - 50)
    .strokeColor(LINE_LIGHT).lineWidth(0.5).stroke();

  const parts = [(profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase()];
  if (profile.registrationNumber) parts.push(`Reg. No. ${profile.registrationNumber}`);
  if (profile.tin) parts.push(`TIN ${profile.tin}`);

  doc.fontSize(7).font('Helvetica').fillColor(TEXT_LIGHT);
  doc.text(parts.join('   •   '), M, pageH - 42, { width: pageW - M * 2, align: 'center' });

  doc.fontSize(6.5).font('Helvetica-Oblique').fillColor('#94a3b8');
  doc.text('This is an official letter of the Club.', M, pageH - 32, { width: pageW - M * 2, align: 'center' });
}

async function generateLetterPDF(letter, res, requestedSigs = []) {
  try {
    setPdfHeaders(res, (letter.referenceNumber || 'letter').replace(/\//g, '-'));
    
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });
    doc.pipe(res);

    const profile = (await ClubProfile.findOne()) || {};

    drawPageFrame(doc);
    drawLetterhead(doc, profile);
    drawLetterBody(doc, letter, profile);
    await drawSignatures(doc, requestedSigs);
    
    // Footer drawn directly
    drawFooter(doc, profile);

    doc.end();
  } catch (err) {
    console.error('generateLetterPDF:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

module.exports = { generateLetterPDF };