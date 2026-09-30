const PDFDocument = require('pdfkit');

function createHeader(doc, title, subtitle = '') {
  doc.fontSize(18).text('CRESTED SS INVESTMENT CLUB LTD', { align: 'center' });
  doc.fontSize(14).text(title, { align: 'center' });
  if (subtitle) doc.fontSize(10).text(subtitle, { align: 'center' });
  doc.moveDown();
  doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
  doc.moveDown();
}

function tableHeader(doc, columns) {
  const startX = doc.x;
  const colWidth = (doc.page.width - 100) / columns.length;
  doc.fontSize(10).fillColor('#000');
  columns.forEach((col, i) => {
    doc.text(col, startX + (i * colWidth), doc.y, { width: colWidth, continued: i < columns.length - 1 });
  });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.3);
}

function tableRow(doc, values) {
  const startX = doc.x;
  const colWidth = (doc.page.width - 100) / values.length;
  const y = doc.y;
  doc.fontSize(9);
  values.forEach((val, i) => {
    doc.text(String(val ?? ''), startX + (i * colWidth), y, { width: colWidth, continued: i < values.length - 1 });
  });
  doc.moveDown(0.3);
}

module.exports = { createHeader, tableHeader, tableRow };