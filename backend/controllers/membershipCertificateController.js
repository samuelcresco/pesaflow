const MembershipCertificate = require('../models/MembershipCertificate');
const Member = require('../models/Member');
const ClubSetting = require('../models/ClubSetting');
const { generateMembershipCertificatePDF } = require('../utils/membershipCertificatePDF');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== NUMBER GENERATOR ====================
async function generateCertificateNumber(year) {
  const prefix = `MC-${year}-`;
  const last = await MembershipCertificate.findOne({
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

// ==================== VALIDITY WINDOW ====================
function getValidityWindow(year) {
  const validFrom = new Date(year, 0, 5);   // Jan 5 of that year
  const validTo = new Date(year + 1, 0, 4); // Jan 4 of next year
  return { validFrom, validTo };
}

// ==================== INTERNAL: issue a cert ====================
async function issueCertificate({ member, year, feePaid, membershipType, issuedBy, paymentSource }) {
  const existing = await MembershipCertificate.findOne({
    memberId: member._id,
    year,
    status: 'active'
  });
  if (existing) return existing;

  const { validFrom, validTo } = getValidityWindow(year);
  const certificateNumber = await generateCertificateNumber(year);

  const cert = await MembershipCertificate.create({
    certificateNumber,
    memberId: member._id,
    memberName: `${member.firstName} ${member.surname}`,
    memberNumber: member.memberNumber,
    year,
    membershipType: membershipType || 'renewal',
    feePaid: Number(feePaid) || 0,
    paymentSource: paymentSource || 'manual',
    validFrom,
    validTo,
    issuedBy: issuedBy || 'system',
    status: 'active'
  });

  return cert;
}
exports._issueCertificate = issueCertificate;

// ==================== LIST ALL (admin) ====================
exports.getAllCertificates = async (req, res) => {
  try {
    const { memberId, year, status, search } = req.query;
    const filter = {};
    if (memberId) filter.memberId = memberId;
    if (year) filter.year = Number(year);
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { certificateNumber: { $regex: search, $options: 'i' } },
        { memberName: { $regex: search, $options: 'i' } },
        { memberNumber: { $regex: search, $options: 'i' } }
      ];
    }
    const certificates = await MembershipCertificate.find(filter).sort('-issueDate').limit(500);
    const totalActive = await MembershipCertificate.countDocuments({ status: 'active' });
    res.json({ certificates, total: certificates.length, totalActive });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MEMBER: list own certs ====================
exports.getMemberCertificates = async (req, res) => {
  try {
    const certificates = await MembershipCertificate.find({ memberId: req.params.memberId }).sort('-issueDate');
    res.json({ certificates, total: certificates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== ADMIN: manual issue ====================
exports.issueManual = async (req, res) => {
  try {
    const { memberId, year, feePaid, membershipType, notes, issuedBy } = req.body;
    if (!memberId || !year) return res.status(400).json({ error: 'memberId and year required' });

    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const cert = await issueCertificate({
      member,
      year: Number(year),
      feePaid: Number(feePaid) || 0,
      membershipType: membershipType || 'renewal',
      issuedBy: issuedBy || 'admin',
      paymentSource: 'manual'
    });

    if (notes) {
      cert.notes = notes;
      await cert.save();
    }

    res.status(201).json({ success: true, certificate: cert });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== ADMIN: cancel ====================
exports.cancelCertificate = async (req, res) => {
  try {
    const { reason, otherReason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Cancellation reason is required' });

    const cert = await MembershipCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    if (cert.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const finalReason = reason === 'Other' && otherReason ? `Other: ${otherReason}` : reason;

    cert.status = 'cancelled';
    cert.cancelledReason = finalReason;
    cert.cancelledAt = new Date();
    cert.cancelledBy = cancelledBy || 'admin';
    await cert.save();

    res.json({ success: true, certificate: cert });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== ADMIN: delete ====================
exports.deleteCertificate = async (req, res) => {
  try {
    const cert = await MembershipCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    await MembershipCertificate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Certificate ${cert.certificateNumber} deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== PDF DOWNLOAD ====================
exports.downloadCertificatePDF = async (req, res) => {
  try {
    const cert = await MembershipCertificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    cert.printedCount = (cert.printedCount || 0) + 1;
    cert.lastPrintedAt = new Date();
    await cert.save();

    await generateMembershipCertificatePDF(cert, res);
  } catch (error) {
    console.error('Membership cert PDF error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== PUBLIC VERIFY ====================
exports.verifyCertificate = async (req, res) => {
  try {
    const cert = await MembershipCertificate.findOne({ certificateNumber: req.params.number });
    if (!cert) return res.status(404).json({ valid: false, error: 'Certificate not found' });
    res.json({
      valid: cert.status === 'active',
      certificate: {
        number: cert.certificateNumber,
        memberName: cert.memberName,
        memberNumber: cert.memberNumber,
        year: cert.year,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        status: cert.status,
        cancelledReason: cert.cancelledReason || null
      },
      verifiedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
};

// ==================== BULK: issue missing certificates ====================
// Scans all members, finds anyone with a membership saving for the given year
// who doesn't have a certificate yet, and issues them.
exports.issueMissingCertificates = async (req, res) => {
  try {
    const Saving = require('../models/Saving');
    const year = Number(req.body.year) || new Date().getFullYear();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // Find every membership saving in that year
    const savings = await Saving.find({
      category: 'membership',
      date: { $gte: yearStart, $lt: yearEnd }
    }).lean();

    // Group by memberId (a member may have multiple partial payments — sum them)
    const byMember = {};
    for (const s of savings) {
      if (!s.memberId) continue;
      const key = String(s.memberId);
      if (!byMember[key]) byMember[key] = { memberId: s.memberId, total: 0 };
      byMember[key].total += Number(s.amount) || 0;
    }

    let issued = 0;
    let skipped = 0;
    let errors = 0;
    const issuedList = [];

    for (const key of Object.keys(byMember)) {
      const { memberId, total } = byMember[key];

      // Skip if member already has an active cert for that year
      const existing = await MembershipCertificate.findOne({ memberId, year, status: 'active' });
      if (existing) { skipped++; continue; }

      const member = await Member.findById(memberId);
      if (!member) { skipped++; continue; }

      try {
        const cert = await issueCertificate({
          member,
          year,
          feePaid: total,
          membershipType: 'renewal',
          issuedBy: req.body.issuedBy || 'admin',
          paymentSource: 'manual'
        });
        issued++;
        issuedList.push({
          memberNumber: member.memberNumber,
          memberName: `${member.firstName} ${member.surname}`,
          certificateNumber: cert.certificateNumber,
          amount: total
        });
      } catch (e) {
        errors++;
        console.error('Bulk issue error for', member.memberNumber, e.message);
      }
    }

    res.json({
      success: true,
      year,
      issued,
      skipped,
      errors,
      issuedList
    });
  } catch (error) {
    console.error('issueMissingCertificates error:', error.message);
    res.status(500).json({ error: error.message });
  }
};