const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Business = require('../models/Business');
const Leader = require('../models/Leader');
const { getLeaderSignature } = require('./leaderHelper');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigits(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return TENS[t] + (r ? '-' + ONES[r] : '');
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  return ONES[h] + ' Hundred' + (r ? ' and ' + threeDigits(r) : '');
}

function amountInWords(amount) {
  const num = Math.floor(Number(amount) || 0);
  if (num === 0) return 'Zero Shillings Only';
  const billion = Math.floor(num / 1_000_000_000);
  const million = Math.floor((num % 1_000_000_000) / 1_000_000);
  const thousand = Math.floor((num % 1_000_000) / 1_000);
  const remainder = num % 1_000;
  const parts = [];
  if (billion) parts.push(threeDigits(billion) + ' Billion');
  if (million) parts.push(threeDigits(million) + ' Million');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (remainder) parts.push(threeDigits(remainder));
  return parts.join(' ') + ' Shillings Only';
}

async function generateSaleReceiptPDF(sale, res, requestedSigs) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const doc = new PDFDocument({ size: 'A5', margin: 0, layout: 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${sale.receiptNumber}.pdf`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 30;
  const contentW = pageW - (M * 2);

  let biz = await Business.findById(sale.businessId);
  const bizName = biz?.name || sale.businessName || 'BUSINESS';
  const bizTagline = biz?.tagline || '';
  const bizContact = [biz?.contact, biz?.email, biz?.address].filter(Boolean).join('  •  ');

  const accent = '#15803d';

  doc.rect(0, 0, pageW, 6).fill(accent);

  doc.fillColor('#0f3460').fontSize(14).font('Helvetica-Bold');
  doc.text(bizName.toUpperCase(), M, 18, { width: contentW, align: 'center' });

  if (bizTagline) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b');
    doc.text(bizTagline, M, 38, { width: contentW, align: 'center' });
  }

  if (bizContact) {
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
    doc.text(bizContact, M, 48, { width: contentW, align: 'center' });
  }

  const rightW = 130;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(accent);
  doc.text('SALE RECEIPT', pageW - M - rightW, 18, { width: rightW, align: 'right' });

  doc.font('Helvetica').fontSize(6.5).fillColor('#94a3b8');
  doc.text('Receipt No.', pageW - M - rightW, 32, { width: rightW, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f3460');
  doc.text(sale.receiptNumber, pageW - M - rightW, 42, { width: rightW, align: 'right' });

  doc.moveTo(M, 68).lineTo(pageW - M, 68).strokeColor('#cbd5e1').lineWidth(1).stroke();

  const dateStr = new Date(sale.date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  let y = 78;
  doc.fontSize(8).fillColor('#1e293b').font('Helvetica-Bold');
  doc.text('Customer:', M, y);
  doc.font('Helvetica').text(sale.customerName || '—', M + 55, y);

  doc.font('Helvetica-Bold').text('Date:', pageW - 130, y);
  doc.font('Helvetica').text(dateStr, pageW - 95, y);

  y += 14;
  if (sale.customerContact) {
    doc.font('Helvetica-Bold').fontSize(8).text('Contact:', M, y);
    doc.font('Helvetica').text(sale.customerContact, M + 55, y);
    y += 14;
  }

  y += 6;
  const colItemX = M + 8;
  const colQtyX = M + contentW - 175;
  const colPriceX = M + contentW - 120;
  const colAmtX = M + contentW - 60;
  const colW = 55;

  doc.rect(M, y, contentW, 20).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5);
  doc.text('ITEM', colItemX, y + 6);
  doc.text('QTY', colQtyX, y + 6, { width: 40, align: 'center' });
  doc.text('UNIT', colPriceX, y + 6, { width: colW, align: 'right' });
  doc.text('AMOUNT', colAmtX, y + 6, { width: colW, align: 'right' });
  y += 20;

  let rowIdx = 0;
  for (const item of sale.items || []) {
    if (rowIdx % 2 === 0) doc.rect(M, y, contentW, 18).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8);
    doc.text(item.productName, colItemX, y + 5, { width: contentW - 200 });
    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    doc.text(String(item.quantity), colQtyX, y + 5, { width: 40, align: 'center' });
    doc.text(fmt(item.unitPrice), colPriceX, y + 5, { width: colW, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(fmt(item.lineTotal), colAmtX, y + 5, { width: colW, align: 'right' });
    y += 18;
    rowIdx++;
  }

  if (sale.discount > 0) {
    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text('Subtotal:', colPriceX - 40, y + 4, { width: 60, align: 'right' });
    doc.text(fmt(sale.subtotal), colAmtX, y + 4, { width: colW, align: 'right' });
    y += 14;
    doc.text('Discount:', colPriceX - 40, y + 4, { width: 60, align: 'right' });
    doc.fillColor('#dc2626').text('-' + fmt(sale.discount), colAmtX, y + 4, { width: colW, align: 'right' });
    y += 14;
  }

  y += 4;
  doc.rect(M, y, contentW, 26).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
  doc.text('TOTAL', colItemX, y + 8);
  doc.fontSize(13).text(`UGX ${fmt(sale.total)}`, colAmtX - 30, y + 6, { width: colW + 30, align: 'right' });
  y += 32;

  doc.fillColor('#334155').font('Helvetica-BoldOblique').fontSize(8);
  doc.text(amountInWords(sale.total), M, y, { width: contentW });
  y += 14;

  doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(8);
  doc.text('Payment:', M, y);
  doc.font('Helvetica').fillColor('#1e293b').text(
    (sale.paymentMethod || 'cash').replace(/_/g, ' ') + (sale.paymentReference ? ` (${sale.paymentReference})` : ''),
    M + 50, y
  );

  // ==================== DYNAMIC SIGNATURES ====================
  const bottomY = pageH - 120;
  const qrSize = 70;
  const qrX = M;
  try {
    const qrUrl = `http://192.168.1.6:5000/api/business/sales/verify/${sale.receiptNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: qrSize });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, bottomY, { width: qrSize, height: qrSize });
    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text('Scan to verify', qrX, bottomY + qrSize + 2, { width: qrSize, align: 'center' });
  } catch (e) { console.error('QR error:', e.message); }

  const sigStartX = M + qrSize + 20;
  const sigAreaW = contentW - qrSize - 20;
  
  // We reserve the right half for the customer signature, and dynamically split the left half for leaders
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

  const custX = sigStartX + leaderAreaW + 15;
  doc.moveTo(custX, bottomY + 40).lineTo(custX + customerSigW, bottomY + 40).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor(accent).fontSize(6.5);
  doc.text('CUSTOMER', custX, bottomY + 45, { width: customerSigW, align: 'center' });

  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#94a3b8');
  doc.text('Thank you for your business!', 0, pageH - 20, { align: 'center', width: pageW });

  doc.end();
}

module.exports = { generateSaleReceiptPDF, amountInWords };