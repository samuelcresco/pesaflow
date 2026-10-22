const Member = require('../models/Member');
const { generateMemberCardPDF, signCard } = require('../utils/memberCardPDF');

// ==================== DOWNLOAD CARD PDF ====================
exports.downloadMemberCard = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (!member.active) return res.status(400).json({ error: 'Member is inactive' });

    await generateMemberCardPDF(member, res);
  } catch (error) {
    console.error('Member card PDF error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY CARD (public) ====================
exports.verifyMemberCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { sig } = req.query;

    const expected = signCard(id);

    if (!sig || sig.toUpperCase() !== expected) {
      return res.status(400).json({ valid: false, error: 'Invalid or tampered card' });
    }

    const member = await Member.findById(id);
    if (!member || !member.active) {
      return res.status(404).json({ valid: false, error: 'Member not found or inactive' });
    }

    const shares = member.shares || {};
    const totalShares = (shares.golden || 0) + (shares.platinum || 0) + (shares.silver || 0) + (shares.bronze || 0);

    res.json({
      valid: true,
      member: {
        name: `${member.firstName} ${member.surname}`,
        memberNumber: member.memberNumber,
        joined: member.dateOfSubscription,
        cardQrMessage: member.cardQrMessage || '',
        shares: {
          golden: shares.golden || 0,
          platinum: shares.platinum || 0,
          silver: shares.silver || 0,
          bronze: shares.bronze || 0,
          total: totalShares
        }
      },
      verifiedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
};