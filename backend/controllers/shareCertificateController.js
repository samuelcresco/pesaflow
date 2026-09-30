const ShareCertificate = require('../models/ShareCertificate');
const Member = require('../models/Member');
const ShareSettings = require('../models/shareSettings.models');
const { generateShareCertificatePDF } = require('../utils/shareCertificatePDF');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== GENERATE CERTIFICATE NUMBER ====================
async function generateCertificateNumber(date = new Date()) {
  const year = new Date(date).getFullYear();
  const prefix = `SC-${year}-`;
  const last = await ShareCertificate.findOne({
    certificateNumber: { $regex: `^${prefix}` }
  }).sort({ certificateNumber: -1 }).lean();

  let nextSeq = 1;
  if (last?.certificateNumber) {
    const parts = last.certificateNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

// ==================== ISSUE CERTIFICATE ====================
exports.issueCertificate = async (req, res) => {
  try {
    const { memberId, notes, issuedBy } = req.body;
    if (!memberId) return res.status(400).json({ error: 'Member is required' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Get current share settings (prices)
    const settings = await ShareSettings.findOne();
    const shareTypes = settings?.shareTypes || {
      golden: { price: 5000 },
      platinum: { price: 20000 },
      silver: { price: 15000 },
      ordinary: { price: 10000 }
    };

    // Snapshot member's shares
    const goldenQty = Number(member.shares?.golden || 0);
    const platinumQty = Number(member.shares?.platinum || 0);
    const silverQty = Number(member.shares?.silver || 0);
    const bronzeQty = Number(member.shares?.bronze || 0);

    const shares = {
      golden:   { qty: goldenQty,   price: shareTypes.golden?.price || 5000,   value: goldenQty * (shareTypes.golden?.price || 5000) },
      platinum: { qty: platinumQty, price: shareTypes.platinum?.price || 20000, value: platinumQty * (shareTypes.platinum?.price || 20000) },
      silver:   { qty: silverQty,   price: shareTypes.silver?.price || 15000,   value: silverQty * (shareTypes.silver?.price || 15000) },
      bronze:   { qty: bronzeQty,   price: shareTypes.ordinary?.price || 10000, value: bronzeQty * (shareTypes.ordinary?.price || 10000) }
    };

    const totalQuantity = goldenQty + platinumQty + silverQty + bronzeQty;
    const totalValue = shares.golden.value + shares.platinum.value + shares.silver.value + shares.bronze.value;

    if (totalQuantity === 0) {
      return res.status(400).json({ error: 'Member has no shares to certify' });
    }

    const certificateNumber = await generateCertificateNumber();

    const cert = await ShareCertificate.create({
      certificateNumber,
      memberId,
      memberName: `${member.firstName} ${member.surname}`,
      memberNumber: member.memberNumber,
      shares,
      totalQuantity,
      totalValue,
      issueDate: new Date(),
      issuedBy: issuedBy || 'admin',
      notes: notes || ''
    });

    res.status(201).json({ success: true, certificate: cert });
  } catch (error) {
    console.error('ISSUE CERT ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL CERTIFICATES ====================
exports.getAllCertificates = async (req, res) => {
  try {
    const { memberId, status, search } = req.query;
    const filter = {};
    if (memberId) filter.memberId = memberId;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { certificateNumber: { $regex: search, $options: 'i' } },
        { memberName: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const certificates = await ShareCertificate.find(filter).sort('-issueDate').limit(500);
    const totalValue = certificates.filter(c => c.status === 'issued').reduce((s, c) => s + Number(c.totalValue || 0), 0);

    res.json({ certificates, total: certificates.length, totalValue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getCertificateById = async (req, res) => {
  try {
    const cert = await ShareCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json(cert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY (public, for QR scan) ====================
exports.verifyCertificate = async (req, res) => {
  try {
    const cert = await ShareCertificate.findOne({ certificateNumber: req.params.number });

    const accept = req.headers.accept || '';
    const wantsHTML = accept.includes('text/html');

    if (!cert) {
      if (wantsHTML) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderVerifyHTML(null, req.params.number));
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(
        `CERTIFICATE NOT FOUND\n` +
        `─────────────────────────────\n` +
        `Certificate: ${req.params.number}\n\n` +
        `This certificate could not be found in the CRESTED SS INVESTMENT CLUB LTD records.\n`
      );
    }

    if (wantsHTML) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderVerifyHTML(cert));
    }

    // Plain text response (for phone cameras / QR scans that don't send HTML accept header)
    const statusLine = cert.status === 'issued' ? 'CERTIFIED TRUE MEMBER' : 'CERTIFICATE CANCELLED';
    const issued = new Date(cert.issueDate).toLocaleDateString('en-GB');
    const cancelledLine = cert.status === 'cancelled'
      ? `\nCancelled: ${cert.cancelledReason || 'no reason'}`
      : '';

    const body =
`${statusLine}
─────────────────────────────
Name:         ${cert.memberName}
Member No:    ${cert.memberNumber}
Certificate:  ${cert.certificateNumber}
Shares Owned: ${cert.totalQuantity}
Total Value:  UGX ${Number(cert.totalValue || 0).toLocaleString('en-UG')}
Issued:       ${issued}
Status:       ${cert.status.toUpperCase()}${cancelledLine}

This document is verified against the records of
CRESTED SS INVESTMENT CLUB LTD.

Verify anytime at:
/api/share-certificates/verify/${cert.certificateNumber}
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== HTML PAGE FOR QR SCANS ====================
function renderVerifyHTML(cert, notFoundNumber) {
  const isFound = !!cert;
  const isIssued = cert?.status === 'issued';
  const issued = cert ? new Date(cert.issueDate).toLocaleDateString('en-GB') : '';
  const color = !isFound ? '#dc2626' : isIssued ? '#15803d' : '#b45309';
  const badge = !isFound ? 'CERTIFICATE NOT FOUND' : isIssued ? 'CERTIFIED TRUE MEMBER' : 'CERTIFICATE CANCELLED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Certificate Verification — CRESTED SS</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f3460; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 16px; padding: 28px 24px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
    .header { text-align: center; margin-bottom: 20px; }
    .logo { font-size: 11px; font-weight: 700; color: #0f3460; letter-spacing: 1px; text-transform: uppercase; }
    .tagline { font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .badge { display: inline-block; padding: 8px 18px; border-radius: 24px; font-size: 13px; font-weight: 700; letter-spacing: 1px; background: ${color}20; color: ${color}; border: 2px solid ${color}; margin: 16px 0; }
    .badge-icon { font-size: 18px; margin-right: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    td { padding: 10px 4px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    td.label { color: #64748b; font-weight: 500; width: 45%; }
    td.value { color: #0f3460; font-weight: 700; text-align: right; }
    .footer { margin-top: 22px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #94a3b8; line-height: 1.5; }
    .check { font-size: 40px; color: ${color}; text-align: center; margin: 4px 0 0 0; line-height: 1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">CRESTED SS INVESTMENT CLUB LTD</div>
      <div class="tagline">Share Certificate Verification</div>
    </div>

    <div class="check">${!isFound ? '✕' : isIssued ? '✓' : '⚠'}</div>

    <div style="text-align: center;">
      <div class="badge"><span class="badge-icon"></span>${badge}</div>
    </div>

    ${isFound ? `
    <table>
      <tr><td class="label">Name</td><td class="value">${escapeHTML(cert.memberName)}</td></tr>
      <tr><td class="label">Member No</td><td class="value">${escapeHTML(cert.memberNumber)}</td></tr>
      <tr><td class="label">Certificate</td><td class="value">${escapeHTML(cert.certificateNumber)}</td></tr>
      <tr><td class="label">Shares</td><td class="value">${cert.totalQuantity}</td></tr>
      <tr><td class="label">Value</td><td class="value">UGX ${Number(cert.totalValue || 0).toLocaleString('en-UG')}</td></tr>
      <tr><td class="label">Issued</td><td class="value">${issued}</td></tr>
    </table>` : `
    <p style="text-align:center; font-size:13px; color:#64748b; margin-top:20px;">
      Certificate <strong>${escapeHTML(notFoundNumber || '')}</strong> was not found in the club records.
    </p>`}

    <div class="footer">
      This document is verified against the records of<br>
      <strong style="color:#0f3460;">CRESTED SS INVESTMENT CLUB LTD</strong>
    </div>
  </div>
</body>
</html>`;
}

function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== DOWNLOAD PDF ====================
exports.downloadCertificatePDF = async (req, res) => {
  try {
    const cert = await ShareCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    cert.printedCount = (cert.printedCount || 0) + 1;
    cert.lastPrintedAt = new Date();
    await cert.save();

    await generateShareCertificatePDF(cert, res);
  } catch (error) {
    console.error('CERT PDF ERROR:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== CANCEL ====================
exports.cancelCertificate = async (req, res) => {
  try {
    const { reason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Cancellation reason is required' });

    const cert = await ShareCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    if (cert.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    cert.status = 'cancelled';
    cert.cancelledReason = reason;
    cert.cancelledAt = new Date();
    cert.cancelledBy = cancelledBy || 'admin';
    await cert.save();

    res.json({ success: true, certificate: cert });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== MEMBER'S CERTIFICATES ====================
exports.getMemberCertificates = async (req, res) => {
  try {
    const certs = await ShareCertificate.find({
      memberId: req.params.memberId,
      status: 'issued'
    }).sort('-issueDate');
    res.json({ certificates: certs, total: certs.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ==================== DELETE CERTIFICATE (permanent — use with care) ====================
exports.deleteCertificate = async (req, res) => {
  try {
    const cert = await ShareCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    await ShareCertificate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Certificate ${cert.certificateNumber} permanently deleted`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};