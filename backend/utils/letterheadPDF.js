const PDFDocument = require('pdfkit');
const ClubProfile = require('../models/ClubProfile');
const Leader = require('../models/Leader');
const { getLeaderSignature } = require('./leaderHelper');

const ACCENT = '#0f3460';

function setPdfHeaders(res, filename) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);
}

// ==================== PAGE FRAME ====================
function drawPageFrame(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  doc.rect(0, 0, pageW, 6).fill(ACCENT);

  doc.rect(20, 20, pageW - 40, pageH - 40)
    .strokeColor(ACCENT).lineWidth(1).stroke();

  doc.rect(26, 26, pageW - 52, pageH - 52)
    .strokeColor(ACCENT).lineWidth(2).stroke();

  const cornerSize = 4;
  const c1 = 26, c2 = pageW - 26 - cornerSize, c3 = 26, c4 = pageH - 26 - cornerSize;
  doc.rect(c1, c3, cornerSize, cornerSize).fill(ACCENT);
  doc.rect(c2, c3, cornerSize, cornerSize).fill(ACCENT);
  doc.rect(c1, c4, cornerSize, cornerSize).fill(ACCENT);
  doc.rect(c2, c4, cornerSize, cornerSize).fill(ACCENT);
}

// ==================== LETTERHEAD ====================
function drawLetterhead(doc, profile) {
  drawPageFrame(doc);

  const pageW = doc.page.width;
  const M = 50;
  const contentW = pageW - M * 2;

  let cursorY = 40;

  const hasLogo = profile.logo && profile.logo.includes('base64');
  if (hasLogo) {
    try {
      const logoBuf = Buffer.from(profile.logo.split(',')[1] || '', 'base64');
      if (logoBuf.length) {
        const logoSize = 46;
        const logoX = (pageW - logoSize) / 2;
        doc.image(logoBuf, logoX, cursorY, { fit: [logoSize, logoSize] });
        cursorY += logoSize + 8;
      }
    } catch (e) { cursorY += 4; }
  } else {
    cursorY += 4;
  }

  const name = (profile.name || 'CRESTED SS INVESTMENT CLUB LTD').toUpperCase();
  const nameSpacing = 0.8;
  doc.fillColor(ACCENT).font('Helvetica-Bold');
  let size = 16;
  doc.fontSize(size);
  while (size > 10) {
    const w = doc.widthOfString(name) + (name.length - 1) * nameSpacing;
    if (w <= contentW) break;
    size -= 1;
    doc.fontSize(size);
  }
  doc.text(name, M, cursorY, { width: contentW, align: 'center', characterSpacing: nameSpacing });
  cursorY = doc.y + 2;

  if (profile.tagline) {
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b');
    doc.text(profile.tagline, M, cursorY, { width: contentW, align: 'center' });
    cursorY = doc.y + 5;
  } else {
    cursorY += 3;
  }

  const contactParts = [profile.contact, profile.email, profile.website].filter(Boolean);
  if (contactParts.length) {
    doc.fontSize(8).font('Helvetica').fillColor('#475569');
    doc.text(contactParts.join('   •   '), M, cursorY, { width: contentW, align: 'center' });
    cursorY = doc.y + 2;
  }

  const addrParts = [profile.postalAddress, profile.location].filter(Boolean);
  if (addrParts.length) {
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text(addrParts.join('   •   '), M, cursorY, { width: contentW, align: 'center' });
    cursorY = doc.y + 2;
  }

  const legal = [];
  if (profile.registrationNumber) legal.push(`Reg. No: ${profile.registrationNumber}`);
  if (profile.tin) legal.push(`TIN: ${profile.tin}`);
  if (legal.length) {
    doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
    doc.text(legal.join('   |   '), M, cursorY, { width: contentW, align: 'center' });
    cursorY = doc.y + 2;
  }

  const dividerY = cursorY + 9;
  doc.moveTo(M, dividerY).lineTo(pageW - M, dividerY)
    .strokeColor(ACCENT).lineWidth(1.5).stroke();

  doc.y = dividerY + 20;
}

// ==================== BODY ====================
function drawLetterBody(doc, letter, profile) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;
  const contentW = pageW - M * 2;

  // Ref + Date
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
  doc.text(`Ref: ${letter.referenceNumber}`, M, doc.y);

  doc.fontSize(10).font('Helvetica').fillColor('#475569');
  doc.text(
    new Date(letter.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    M, doc.y - 14,
    { width: contentW, align: 'right' }
  );
  doc.moveDown(2.0);

  // Recipient
  const r = letter.recipient || {};
  if (r.name || r.title || r.organization || r.address) {
    doc.fontSize(11).font('Helvetica').fillColor('#1e293b');
    if (r.name) doc.text(r.name, M, doc.y);
    if (r.title) doc.text(r.title, M, doc.y);
    if (r.organization) doc.text(r.organization, M, doc.y);
    if (r.address) doc.text(r.address, M, doc.y);
    doc.moveDown(1.5);
  }

  // Salutation
  if (r.salutation) {
    doc.fontSize(11).font('Helvetica').fillColor('#1e293b');
    doc.text(r.salutation, M, doc.y);
    doc.moveDown(1.3);
  }

  // Subject — full-width underline
  doc.fontSize(11).font('Helvetica-Bold').fillColor(ACCENT);
  const subjectText = (letter.subject || '').toUpperCase();
  const subjectSpacing = 0.4;
  const baseWidth = doc.widthOfString(subjectText);
  const adjustedWidth = baseWidth + (subjectText.length > 1 ? (subjectText.length - 1) * subjectSpacing : 0);
  const underlineWidth = Math.min(adjustedWidth, contentW);
  doc.text(subjectText, M, doc.y, { width: contentW, characterSpacing: subjectSpacing });
  doc.moveTo(M, doc.y + 4).lineTo(M + underlineWidth, doc.y + 4)
    .strokeColor(ACCENT).lineWidth(0.8).stroke();
  doc.moveDown(1.6);

  // Body
  doc.fontSize(11).font('Helvetica').fillColor('#1e293b');
  (letter.body || []).forEach(para => {
    if (!para) return;
    const textH = doc.heightOfString(para, { width: contentW, align: 'justify', lineGap: 6 });
    if (doc.y + textH > pageH - 200) {
      doc.addPage();
      drawPageFrame(doc);
      doc.y = 80;
    }
    doc.text(para, M, doc.y, { width: contentW, align: 'justify', lineGap: 6 });
    doc.moveDown(1.3);
  });

  // ── Balanced signature position ──
  // closingY = position of "Yours faithfully" baseline for balanced bottom
  const closingY = pageH - 220;

  if (doc.y > closingY + 20) {
    // Content too long — start a fresh page for closing + signatures
    doc.addPage();
    drawPageFrame(doc);
    doc.y = 100;
  } else if (doc.y < closingY - 30) {
    // Content ends early — pad so signature block sits at balanced position
    doc.y = closingY;
  }
  // else: content ends close to closingY — use natural flow

  doc.fontSize(11).font('Helvetica').fillColor('#1e293b');
  doc.text('Yours faithfully,', M, doc.y);
  doc.moveDown(3.2);
}

// ==================== SIGNATURES ====================
async function drawSignatures(doc, requestedSigs) {
  if (!requestedSigs || requestedSigs.length === 0) return;

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;
  const contentW = pageW - M * 2;
  const numSigs = requestedSigs.length;
  const spacing = 30;
  const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;

  // Safety net — if somehow no room, break to new page
  if (doc.y > pageH - 130) {
    doc.addPage();
    drawPageFrame(doc);
    doc.y = 130;
  }

  const lineY = doc.y;

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
       .strokeColor('#1e293b').lineWidth(0.8).stroke();

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(leader?.name || '__________________', x, lineY + 6, {
      width: sigW, align: 'center'
    });

    doc.fontSize(8).font('Helvetica').fillColor(ACCENT);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, lineY + 22, {
      width: sigW, align: 'center', characterSpacing: 0.5
    });
  }

  doc.y = lineY + 44;
}

// ==================== FOOTER ====================
function drawFooter(doc, profile) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;

  doc.moveTo(M, pageH - 56).lineTo(pageW - M, pageH - 56)
    .strokeColor('#cbd5e1').lineWidth(0.5).stroke();

  const parts = ['CRESTED SS INVESTMENT CLUB LTD'];
  if (profile.registrationNumber) parts.push(`Reg. No. ${profile.registrationNumber}`);
  if (profile.tin) parts.push(`TIN ${profile.tin}`);

  doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
  doc.text(parts.join('   •   '), M, pageH - 48, {
    width: pageW - M * 2, align: 'center'
  });

  doc.fontSize(6.5).font('Helvetica-Oblique').fillColor('#cbd5e1');
  doc.text('This is an official letter of the Club.', M, pageH - 38, {
    width: pageW - M * 2, align: 'center'
  });
}

// ==================== MAIN ====================
async function generateLetterPDF(letter, res, requestedSigs = []) {
  try {
    setPdfHeaders(res, (letter.referenceNumber || 'letter').replace(/\//g, '-'));
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const profile = (await ClubProfile.findOne()) || {};

    drawLetterhead(doc, profile);
    drawLetterBody(doc, letter, profile);
    await drawSignatures(doc, requestedSigs);
    drawFooter(doc, profile);

    doc.end();
  } catch (err) {
    console.error('generateLetterPDF:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

module.exports = { generateLetterPDF };