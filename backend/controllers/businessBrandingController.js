const Business = require('../models/Business');

// ==================== UPDATE BRANDING + RETENTION ====================
exports.updateBranding = async (req, res) => {
  try {
    const biz = await Business.findById(req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const fields = ['name', 'description', 'tagline', 'contact', 'email', 'address', 'logo', 'minimumRetention'];
    for (const f of fields) {
      if (req.body[f] !== undefined) biz[f] = req.body[f];
    }

    await biz.save();
    res.json({ success: true, business: biz });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET BRANDING ====================
exports.getBranding = async (req, res) => {
  try {
    const biz = await Business.findById(req.params.id);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    res.json({
      _id: biz._id,
      name: biz.name,
      description: biz.description,
      tagline: biz.tagline,
      contact: biz.contact,
      email: biz.email,
      address: biz.address,
      logo: biz.logo,
      minimumRetention: biz.minimumRetention,
      currentBalance: biz.currentBalance,
      totalProfitDeclared: biz.totalProfitDeclared
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};