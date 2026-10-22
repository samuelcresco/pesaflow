const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const ClubProfile = require('../models/ClubProfile');
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

function typeLabel(type) {
  const labels = {
    savings_deposit: 'SAVINGS DEPOSIT RECEIPT',
    savings_withdrawal: 'SAVINGS WITHDRAWAL VOUCHER',
    share_purchase: 'SHARE PURCHASE RECEIPT',
    membership_fee: 'MEMBERSHIP FEE RECEIPT',
    loan_disbursement: 'LOAN DISBURSEMENT VOUCHER',
    loan_repayment: 'LOAN REPAYMENT RECEIPT',
    dividend: 'DIVIDEND VOUCHER',
    penalty: 'PENALTY RECEIPT',
    external_donation: 'DONATION RECEIPT',
    club_expense: 'PAYMENT VOUCHER',
    fund_transfer: 'FUND TRANSFER VOUCHER',
    multi_item: 'MULTI-ITEM PAYMENT RECEIPT'
  };
  return labels[type] || 'RECEIPT';
}

function typeAccent(type) {
  if (['savings_withdrawal', 'loan_disbursement', 'club_expense'].includes(type)) return '#b91c1c';
  if (['multi_item', 'savings_deposit', 'share_purchase', 'membership_fee', 'loan_repayment', 'dividend', 'external_donation', 'penalty'].includes(type)) return '#15803d';
  return '#0f3460';
}

function buildLineItems(receipt) {
  if (receipt.lineItems && receipt.lineItems.length > 0) {
    return receipt.lineItems.map(li => ({
      label: li.label || li.category || 'Item',
      quantity: li.quantity || 0,
      amount: Number(li.amount) || 0
    }));
  }
  return [{
    label: receipt.description || (receipt.category ? receipt.category.replace(/_/g, ' ') : 'Amount'),
    quantity: 0,
    amount: Number(receipt.amount) || 0
  }];
}

async function drawReceipt(doc, receipt, signatories) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const accent = typeAccent(receipt.type);
  const M = 40;
  const contentW = pageW - (M * 2);

  let profile = await ClubProfile.findOne();
  if (!profile) profile = {};

  const clubName = profile.name || 'CRESTED SS INVESTMENT CLUB LTD';
  const clubTagline = profile.tagline || '';
  const contactParts = [
    profile.location, profile.address, profile.postalAddress,
    profile.contact, profile.email, profile.website
  ].filter(Boolean);
  const clubContactLine = contactParts.join('  •  ');

  doc.rect(0, 0, pageW, 8).fill(accent);

  const rightColW = 140;
  const leftColW = contentW - rightColW - 12;
  let cursorY = 20;

  doc.fillColor('#0f3460').fontSize(13).font('Helvetica-Bold');
  doc.text(clubName, M, cursorY, { width: leftColW });
  cursorY = doc.y + 2;

  if (clubTagline) {
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(clubTagline, M, cursorY, { width: leftColW });
    cursorY = doc.y + 3;
  }

  if (clubContactLine) {
    doc.font('Helvetica').fontSize(8).fillColor('#64748b');
    doc.text(clubContactLine, M, cursorY, { width: contentW });
    cursorY = doc.y;
  }

  doc.fillColor(accent).fontSize(14).font('Helvetica-Bold');
  doc.text(receipt.receiptNumber, pageW - M - rightColW, 20, { width: rightColW, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b');
  doc.text(typeLabel(receipt.type), pageW - M - rightColW, 40, { width: rightColW, align: 'right' });

  const dividerY = Math.max(cursorY + 8, 78);
  doc.moveTo(M, dividerY).lineTo(pageW - M, dividerY).strokeColor('#cbd5e1').lineWidth(1).stroke();

  const dateY = dividerY + 14;
  const dateStr = new Date(receipt.date).toLocaleString('en-UG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  doc.fontSize(10).fillColor('#1e293b').font('Helvetica-Bold');
  doc.text('Date:', M, dateY);
  doc.font('Helvetica').text(dateStr, M + 42, dateY);

  doc.font('Helvetica-Bold').text('Status:', pageW - 210, dateY);
  doc.font('Helvetica-Bold').fillColor(receipt.status === 'cancelled' ? '#b91c1c' : '#15803d');
  doc.text(receipt.status.toUpperCase(), pageW - 168, dateY);

  const rfY = dateY + 26;
  doc.fillColor('#0f3460').fontSize(11).font('Helvetica-Bold');
  doc.text('RECEIVED FROM', M, rfY);

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b');
  doc.text(receipt.memberName || '—', M, rfY + 20);

  if (receipt.memberNumber) {
    doc.font('Helvetica').fontSize(10).fillColor('#475569');
    doc.text('Member No: ' + receipt.memberNumber, M, rfY + 40);
  }

  let y = rfY + 62;
  const colLabelX = M + 12;
  const colQtyX = M + contentW - 200;
  const colAmtX = M + contentW - 140;
  const colAmtW = 130;

  doc.rect(M, y, contentW, 28).fill('#0f3460');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11);
  doc.text('ITEM', colLabelX, y + 9);
  doc.text('QTY', colQtyX, y + 9, { width: 50, align: 'center' });
  doc.text('AMOUNT (UGX)', colAmtX, y + 9, { width: colAmtW, align: 'right' });
  y += 28;

  const items = buildLineItems(receipt);
  let rowIdx = 0;
  const rowH = 26;
  for (const item of items) {
    if (rowIdx % 2 === 0) doc.rect(M, y, contentW, rowH).fill('#f8fafc');
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11);
    doc.text(item.label, colLabelX, y + 8, { width: contentW - 210 });

    if (item.quantity > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#475569');
      doc.text(String(item.quantity), colQtyX, y + 8, { width: 50, align: 'center' });
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e293b');
    doc.text(fmt(item.amount), colAmtX, y + 8, { width: colAmtW, align: 'right' });

    y += rowH;
    rowIdx++;
  }

  y += 6;
  doc.rect(M, y, contentW, 34).fill(accent);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13);
  doc.text('GRAND TOTAL', colLabelX, y + 10);
  doc.fontSize(16);
  doc.text(`UGX ${fmt(receipt.amount)}`, colAmtX, y + 8, { width: colAmtW, align: 'right' });
  y += 42;

  doc.fillColor('#334155').font('Helvetica-BoldOblique').fontSize(10);
  doc.text(amountInWords(receipt.amount), M, y, { width: contentW });
  y += 20;

  if (receipt.notes) {
    doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(9);
    doc.text('Notes:', M, y);
    doc.font('Helvetica').fillColor('#1e293b').fontSize(9);
    doc.text(receipt.notes, M + 45, y, { width: contentW - 45 });
  }

  const bottomY = pageH - 145;
  const qrSize = 95;
  const qrX = M;
  const qrY = bottomY;

  try {
    const verifyUrl = `http://localhost:5000/api/receipts/verify/${receipt.receiptNumber}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: qrSize });
    const qrBase64 = qrDataUrl.split(',')[1];
    const qrBuffer = Buffer.from(qrBase64, 'base64');
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    doc.font('Helvetica-Bold').fillColor('#64748b').fontSize(7);
    doc.text('Scan to verify', qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
  } catch (e) {
    doc.font('Helvetica').fillColor('#94a3b8').fontSize(8);
    doc.text('QR unavailable', qrX, qrY + 30, { width: qrSize, align: 'center' });
  }

  const sigStartX = M + qrSize + 25;
  const sigAreaW = contentW - qrSize - 25;
  const numSigs = signatories.length;
  
  if (numSigs > 0) {
    const sigW = (sigAreaW - (numSigs - 1) * 15) / numSigs;

    for (let i = 0; i < numSigs; i++) {
      const role = signatories[i];
      const x = sigStartX + i * (sigW + 15);
      
      const leader = await Leader.findOne({ role, active: true });
      const sigBuffer = await getLeaderSignature(role);

      doc.moveTo(x, bottomY + 50).lineTo(x + sigW, bottomY + 50).strokeColor('#1e293b').lineWidth(0.8).stroke();
      
      if (sigBuffer) {
        try {
          doc.image(sigBuffer, x, bottomY + 30, { fit: [sigW, 18], align: 'center', valign: 'bottom' });
        } catch (e) {}
      }

      doc.font('Helvetica-Bold').fillColor('#0f3460').fontSize(8);
      const roleLabel = role.replace(/_/g, ' ').toUpperCase();
      doc.text(roleLabel, x, bottomY + 56, { width: sigW, align: 'center' });
      
      doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(9);
      doc.text(leader?.name || '__________________', x, bottomY + 70, { width: sigW, align: 'center' });
      
      doc.font('Helvetica').fillColor('#64748b').fontSize(7);
      doc.text('Date: ____________', x, bottomY + 85, { width: sigW, align: 'center' });
    }
  }

  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#94a3b8');
  doc.text(
    'This is a computer-generated receipt. Retain for your records.',
    M, pageH - 25, { width: contentW, align: 'center' }
  );
}

async function generateReceiptPDF(receipt, res, requestedSigs) {
  let signatories = requestedSigs && requestedSigs.length > 0 
    ? requestedSigs 
    : ['treasurer', 'president'];

  const doc = new PDFDocument({ size: 'A5', margin: 0, layout: 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${receipt.receiptNumber}.pdf`);
  doc.pipe(res);
  
  await drawReceipt(doc, receipt, signatories);
  doc.end();
}

module.exports = { generateReceiptPDF, amountInWords, typeLabel };