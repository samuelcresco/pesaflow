 const PDFDocument = require('pdfkit');
const Leader = require('../models/Leader');
const { getLeaderSignature } = require('./leaderHelper');

const CLUB_NAME = 'CRESTED SS INVESTMENT CLUB LTD';
const ACCENT = '#0f3460';

// ==================== HEADER ====================
function createHeader(doc, title, subtitle = '') {
  const pageW = doc.page.width;
  const M = 50;
  const contentW = pageW - (M * 2);

  doc.rect(0, 0, pageW, 6).fill(ACCENT);

  doc.fillColor(ACCENT).fontSize(18).font('Helvetica-Bold');
  doc.text(CLUB_NAME, M, 22, { width: contentW, align: 'center' });

  doc.moveTo(M + 80, 48).lineTo(pageW - M - 80, 48)
    .strokeColor(ACCENT).lineWidth(1.5).stroke();

  doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold');
  doc.text(title, M, 58, { width: contentW, align: 'center' });

  if (subtitle) {
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b');
    doc.text(subtitle, M, 80, { width: contentW, align: 'center' });
  }

  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
  doc.text(`Generated: ${new Date().toLocaleString()}`, M, subtitle ? 98 : 80, {
    width: contentW, align: 'right'
  });

  doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
  doc.y = subtitle ? 120 : 100;
}

// ==================== TABLE HEADER ====================
function tableHeader(doc, columns, options = {}) {
  const { align = [], fill = ACCENT, color = '#fff' } = options;
  const startX = 50;
  const totalW = doc.page.width - 100;
  const colW = totalW / columns.length;
  const y = doc.y;
  const rowH = 22;

  doc.rect(startX, y, totalW, rowH).fill(fill);
  doc.fillColor(color).fontSize(10).font('Helvetica-Bold');

  columns.forEach((col, i) => {
    const alignMode = align[i] || 'left';
    doc.text(col, startX + (i * colW) + 6, y + 6, {
      width: colW - 12,
      align: alignMode
    });
  });

  doc.y = y + rowH + 4;
  doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
}

// ==================== TABLE ROW ====================
function tableRow(doc, values, options = {}) {
  const { align = [], stripe = false, total = false } = options;
  const startX = 50;
  const totalW = doc.page.width - 100;
  const colW = totalW / values.length;
  const y = doc.y;
  const rowH = total ? 22 : 18;

  if (total) {
    doc.rect(startX, y, totalW, rowH).fill('#e0f2fe');
  } else if (stripe) {
    doc.rect(startX, y, totalW, rowH).fill('#f8fafc');
  }

  doc.fillColor(total ? ACCENT : '#1e293b')
    .fontSize(total ? 10 : 9)
    .font(total ? 'Helvetica-Bold' : 'Helvetica');

  values.forEach((val, i) => {
    const alignMode = align[i] || 'left';
    doc.text(String(val ?? ''), startX + (i * colW) + 6, y + (total ? 6 : 4), {
      width: colW - 12,
      align: alignMode
    });
  });

  doc.y = y + rowH;
}

// ==================== SIGNATURES ====================
async function drawSignatures(doc, requestedSigs) {
  if (!requestedSigs || requestedSigs.length === 0) return;

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 50;
  const contentW = pageW - (M * 2);
  const numSigs = requestedSigs.length;
  const spacing = 15;
  const sigW = (contentW - (numSigs - 1) * spacing) / numSigs;
  const bottomY = pageH - 90;

  if (doc.y > bottomY - 30) {
    doc.addPage();
  }

  for (let i = 0; i < numSigs; i++) {
    const role = requestedSigs[i];
    const x = M + i * (sigW + spacing);

    const leader = await Leader.findOne({ role, active: true });
    const sigBuffer = await getLeaderSignature(role);

    doc.moveTo(x, bottomY).lineTo(x + sigW, bottomY)
      .strokeColor('#1e293b').lineWidth(0.8).stroke();

    if (sigBuffer) {
      try {
        doc.image(sigBuffer, x, bottomY - 25, {
          fit: [sigW, 20], align: 'center', valign: 'bottom'
        });
      } catch (e) {}
    }

    doc.font('Helvetica-Bold').fillColor(ACCENT).fontSize(7);
    doc.text(role.replace(/_/g, ' ').toUpperCase(), x, bottomY + 5, {
      width: sigW, align: 'center'
    });

    doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(8);
    doc.text(leader?.name || '__________________', x, bottomY + 17, {
      width: sigW, align: 'center'
    });
  }
}

module.exports = { createHeader, tableHeader, tableRow, drawSignatures };