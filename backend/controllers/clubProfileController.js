const ClubProfile = require('../models/ClubProfile');

// ==================== GET PROFILE ====================
// Creates default profile if none exists (auto-seed on first GET)
exports.getProfile = async (req, res) => {
  try {
    let profile = await ClubProfile.findOne();
    if (!profile) {
      profile = await ClubProfile.create({});
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== UPDATE PROFILE ====================
exports.updateProfile = async (req, res) => {
  try {
    let profile = await ClubProfile.findOne();
    if (!profile) profile = new ClubProfile();

    const fields = [
      'name', 'tagline', 'location', 'address', 'postalAddress',
      'contact', 'email', 'website', 'registrationNumber', 'tin',
      'logo', 'updatedBy'
    ];

    fields.forEach(f => {
      if (req.body[f] !== undefined) profile[f] = req.body[f];
    });

    await profile.save();
    res.json({ success: true, profile });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};