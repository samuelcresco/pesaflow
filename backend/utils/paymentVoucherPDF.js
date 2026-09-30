const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ClubProfile = require('../models/ClubProfile');
const Business = require('../models/Business');
const Leader = require('../models/Leader');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// Amount in words
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

async function generatePaymentVoucherPDF(voucher, res) {
  const doc = new PDFDocument({ size: 'A5', margin: 0, layout: 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${voucher.voucherNumber}.pdf`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 30;
  const contentW = pageW - (M * 2);

  // ---- Fetch club / business header ----
  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};

  let headerName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  let headerTagline = profile.tagline || '';
  let headerContact = [
    profile.location, profile.address, profile.postalAddress,
    profile.contact, profile.email, profile.website
  ].filter(Boolean).join('  •  ');

  if (voucher.voucherFor === 'business' && voucher.businessId) {
    const biz = await Business.findById(voucher.businessId);
    if (biz) {
      headerName = biz.name;
      headerTagline = biz.description || 'Business Unit';
      headerContact = [biz.contact, biz.email, biz.address].filter(Boolean).join('  •  ') || headerContact;
    }
  }

  const leaders = await Leader.find().sort('order');
  const treasurer = leaders.find(l => l.role === 'treasurer');
  const president = leaders.find(l => l.role === 'president');

  const accent = voucher.voucherFor === 'business' ? '#7c3aed' : '#0f3460';

  // ---- Top color bar ----
  doc.rect(0, 0, pageW, 6).fill(accent);

  // ---- Header ----
  doc.fillColor(accent).fontSize(12).font('Helvetica-Bold');
  doc.text('PAYMENT VOUCHER', 0, 16, { align: 'center', width: pageW });

  doc.fillColor('#0f3460').fontSize(10).font('Helvetica-Bold');
  doc.text(headerName, M, 36, { width: contentW, align: 'center' });

  if (headerTagline) {
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b');
    doc.text(headerTagline, M, 50, { width: contentW, align: 'center' });
  }

  if (headerContact) {
    doc.font('Helvetica').fontSize(6.5).fillColor('#94a3b8');
    doc.text(headerContact, M, 60, { width: contentW, align: 'center' });
  }

  // Voucher number (top right)
  doc.font('Helvetica').fontSize(7).fillColor('#94a3b8');
  doc.text('Voucher No.', pageW - 130, 20, { width: 100, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(accent);
  doc.text(voucher.voucherNumber, pageW - 130, 30, { width: 100, align: 'right' });

  // Divider
  doc.moveTo(M, 78).lineTo(pageW - M, 78).strokeColor('#cbd5e1').lineWidth(1).stroke();

  // ---- Meta row ----
  const dateStr = new Date(voucher.date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  let y = 88;
  doc.fontSize(8).fillColor('#1e293b').font('Helvetica-Bold');
  doc.text('Date:', M, y);
  doc.font('Helvetica').text(dateStr, M + 32, y);

  doc.font('Helvetica-Bold').text('Status:', pageW - 130, y);
  doc.font('Helvetica-Bold').fillColor(voucher.status === 'cancelled' ? '#b91c1c' : '#15803d');
  doc.text(voucher.status.toUpperCase(), pageW - 95, y);

  y += 16;

  // ---- Payee & Cashier ----
  doc.fillColor(accent).fontSize(9).font('Helvetica-Bold');
  doc.text('PAID TO:', M, y);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b');
  doc.text(voucher.payee || '—', M + 55, y - 1);

  y += 20;
  if (voucher.cashier) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b');
    doc.text('Cashier:', M, y);
    doc.font('Helvetica').fillColor('#1e293b').text(voucher.cashier, M + 50, y);
    y += 14;
  }

  // ---- Line items table ----
  y += 4;
  const colDescX = M + 8;
  const colCatX = M + contentW - 200;
  const colAmtX = M + contentW - 90;
  const colAmtW = 85;

  doc.rect(M, y, contentW, 20).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
  doc.text('DESCRIPTION', colDescX, y + 6);
  doc.text('CATEGORY', colCatX, y + 6);
  doc.text('AMOUNT (UGX)', colAmtX, y + 6, { width: colAmtW, align: 'right' });
  y += 20;

  const items = voucher.lineItems || [];
  let rowIdx = 0;
  for (const item of items) {
    if (rowIdx % 2 === 0) doc.rect(M, y, contentW, 20).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
    doc.text(item.description || '—', colDescX, y + 6, { width: contentW - 220 });
    doc.fillColor('#64748b').text((item.category || '').replace(/_/g, ' '), colCatX, y + 6, { width: 100 });
    doc.fillColor('#1e293b').font('Helvetica-Bold').text(fmt(item.amount), colAmtX, y + 6, { width: colAmtW, align: 'right' });
    y += 20;
    rowIdx++;
  }

  // Total row
  y += 3;
  doc.rect(M, y, contentW, 26).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
  doc.text('TOTAL', colDescX, y + 8);
  doc.fontSize(12).text(`UGX ${fmt(voucher.totalAmount)}`, colAmtX - 20, y + 6, { width: colAmtW + 20, align: 'right' });
  y += 32;

  // Amount in words
  doc.fillColor('#334155').font('Helvetica-BoldOblique').fontSize(8);
  doc.text(amountInWords(voucher.totalAmount), M, y, { width: contentW });
  y += 14;

  // Notes
  if (voucher.notes) {
    doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(7.5);
    doc.text('Notes: ', M, y);
    doc.font('Helvetica').fillColor('#1e293b').text(voucher.notes, M + 35, y, { width: contentW - 35 });
  }

  // ---- Bottom section: QR + Signatures ----
  const bottomY = pageH - 125;

  // QR
  const qrSize = 75;
  const qrX = M;
  try {
    const qrUrl = `http://192.168.1.6:5000/api/expenses/vouchers/verify/${voucher.voucherNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: qrSize });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, qrX, bottomY, { width: qrSize, height: qrSize });
    doc.font('Helvetica').fontSize(6).fillColor('#64748b');
    doc.text('Scan to verify', qrX, bottomY + qrSize + 2, { width: qrSize, align: 'center' });
  } catch (e) {
    console.error('QR error:', e.message);
  }

  // Signatures
  const sigX = M + qrSize + 15;
  const sigW = contentW - qrSize - 15;
  const halfW = (sigW - 10) / 2;

  // Treasurer
  doc.moveTo(sigX, bottomY + 45).lineTo(sigX + halfW, bottomY + 45).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor(accent).fontSize(7);
  doc.text('TREASURER', sigX, bottomY + 50, { width: halfW });
  doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(8);
  doc.text(treasurer?.name || '__________________', sigX, bottomY + 62, { width: halfW });
  doc.font('Helvetica').fillColor('#94a3b8').fontSize(6.5);
  doc.text('Date: ____________', sigX, bottomY + 76, { width: halfW });

  // President (or Business Manager)
  const presX = sigX + halfW + 10;
  doc.moveTo(presX, bottomY + 45).lineTo(presX + halfW, bottomY + 45).strokeColor('#1e293b').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fillColor(accent).fontSize(7);
  doc.text(voucher.voucherFor === 'business' ? 'BUSINESS MANAGER' : 'PRESIDENT', presX, bottomY + 50, { width: halfW });
  doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(8);
  doc.text(president?.name || '__________________', presX, bottomY + 62, { width: halfW });
  doc.font('Helvetica').fillColor('#94a3b8').fontSize(6.5);
  doc.text('Date: ____________', presX, bottomY + 76, { width: halfW });

  // Footer
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#94a3b8');
  doc.text('This is a computer-generated payment voucher.', 0, pageH - 20, { align: 'center', width: pageW });

  doc.end();
}

module.exports = { generatePaymentVoucherPDF, amountInWords };