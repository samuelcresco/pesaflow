const Leader = require('../models/Leader');

// ==================== ROLE → CARD ACCESS DEFAULTS ====================
const CARD_DEFAULTS = {
  president: ['members','savings','loans','withdrawals','receipts','statements','business','profit-pool','dividends','investments','expenses','reports','share-settings','leaders','club-profile','delivery-notes'],
  vice_president: ['members','savings','loans','withdrawals','receipts','statements','business','profit-pool','dividends','investments','expenses','reports','share-settings','leaders','club-profile','delivery-notes'],
  secretary: ['members','savings','receipts','statements','reports'],
  treasurer: ['savings','withdrawals','receipts','statements','dividends','expenses','reports'],
  chairman_loan_committee: ['loans','statements','reports'],
  treasurer_loan_committee: ['loans','statements','reports'],
  loan_officer_1: ['loans'],
  loan_officer_2: ['loans'],
  it_technician: ['members','savings','loans','withdrawals','receipts','statements','business','profit-pool','dividends','investments','expenses','reports','share-settings','leaders','club-profile','delivery-notes'],
  chair_investment_committee: ['business','profit-pool','investments','expenses','reports','delivery-notes']
};

// ==================== PASSWORD GENERATOR ====================
function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// ==================== GET ALL ====================
exports.getAllLeaders = async (req, res) => {
  try {
    const { active, role } = req.query;
    const filter = {};
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;
    if (role) filter.role = role;

    const leaders = await Leader.find(filter).sort('order role');
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getLeaderById = async (req, res) => {
  try {
    const leader = await Leader.findById(req.params.id);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    res.json(leader);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== CREATE (Admin only) ====================
exports.createLeader = async (req, res) => {
  try {
    const {
      role, name, contact, email, photo, signature,
      order, active, notes, username, cardAccess, createdBy
    } = req.body;

    if (!role) return res.status(400).json({ error: 'Role is required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!contact || !contact.trim()) return res.status(400).json({ error: 'Contact is required' });

    // Check if this role already has an active leader
    const existing = await Leader.findOne({ role, active: true });
    if (existing) {
      return res.status(400).json({
        error: `An active ${role.replace(/_/g, ' ')} already exists (${existing.name}). Deactivate them first, or edit them.`
      });
    }

    // Generate username if not provided
    let finalUsername = username && username.trim() ? username.trim().toLowerCase() : null;
    if (finalUsername) {
      const dup = await Leader.findOne({ username: finalUsername });
      if (dup) return res.status(400).json({ error: `Username "${finalUsername}" is already taken` });
    } else {
      // Auto-generate: role_lowercase + random 3 digits
      finalUsername = role.replace(/_/g, '') + Math.floor(100 + Math.random() * 900);
      let attempt = 0;
      while (await Leader.findOne({ username: finalUsername }) && attempt < 10) {
        finalUsername = role.replace(/_/g, '') + Math.floor(100 + Math.random() * 900);
        attempt++;
      }
    }

    // Generate password
    const plainPassword = generatePassword(8);

    // Card access: use provided, else defaults from role
    const finalAccess = (cardAccess && cardAccess.length > 0)
      ? cardAccess
      : (CARD_DEFAULTS[role] || []);

    const leader = await Leader.create({
      role,
      name: name.trim(),
      contact: contact.trim(),
      email: email || '',
      photo: photo || '',
      signature: signature || '',
      order: Number(order) || 0,
      active: active !== false,
      notes: notes || '',
      username: finalUsername,
      password: plainPassword,       // will be hashed by pre-save hook
      cardAccess: finalAccess,
      createdBy: createdBy || 'admin'
    });

    // Return the plain password ONCE — admin gives it to the leader
    // We don't save plainPassword to DB for security
    res.status(201).json({
      success: true,
      leader: {
        _id: leader._id,
        role: leader.role,
        name: leader.name,
        username: leader.username,
        cardAccess: leader.cardAccess
      },
      credentials: {
        username: finalUsername,
        password: plainPassword,
        message: '⚠️ Save this password now — it will NOT be shown again. The leader must change it on first login.'
      }
    });
  } catch (error) {
    console.error('CREATE LEADER ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== UPDATE (Admin only) ====================
exports.updateLeader = async (req, res) => {
  try {
    const leader = await Leader.findById(req.params.id);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const fields = ['role', 'name', 'contact', 'email', 'photo', 'signature', 'order', 'active', 'notes', 'cardAccess', 'username'];
    for (const f of fields) {
      if (req.body[f] !== undefined) leader[f] = req.body[f];
    }

    await leader.save();
    res.json({ success: true, leader });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RESET PASSWORD (Admin only) ====================
exports.resetPassword = async (req, res) => {
  try {
    const leader = await Leader.findById(req.params.id).select('+password');
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const plainPassword = generatePassword(8);
    leader.password = plainPassword;
    leader.mustChangePassword = true;
    leader.passwordChangedAt = new Date();
    await leader.save();

    res.json({
      success: true,
      credentials: {
        username: leader.username,
        password: plainPassword,
        message: '⚠️ Save this password now — it will NOT be shown again.'
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE (Admin only) ====================
exports.deleteLeader = async (req, res) => {
  try {
    const leader = await Leader.findByIdAndDelete(req.params.id);
    if (!leader) return res.status(404).json({ error: 'Leader not found' });
    res.json({ success: true, message: 'Leader deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REORDER ====================
exports.reorderLeaders = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of {id, order}' });
    }
    for (const item of order) {
      await Leader.findByIdAndUpdate(item.id, { order: item.order });
    }
    const leaders = await Leader.find().sort('order role');
    res.json({ success: true, leaders });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== LOGIN (for leaders) ====================
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const leader = await Leader.findOne({ username: username.trim().toLowerCase() }).select('+password');
    if (!leader) return res.status(401).json({ error: 'Invalid credentials' });
    if (!leader.active) return res.status(401).json({ error: 'Account is inactive' });
    if (!leader.password) return res.status(401).json({ error: 'No password set. Contact admin.' });

    const isMatch = await leader.comparePassword(password.trim());
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    leader.lastLogin = new Date();
    await leader.save();

    res.json({
      success: true,
      user: {
        id: leader._id,
        username: leader.username,
        name: leader.name,
        role: leader.role,
        cardAccess: leader.cardAccess,
        mustChangePassword: leader.mustChangePassword
      }
    });
  } catch (error) {
    console.error('LEADER LOGIN ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// ==================== EXPORT DEFAULTS (for frontend) ====================
exports.getCardDefaults = async (req, res) => {
  res.json({ defaults: CARD_DEFAULTS });
};
// ==================== CHANGE PASSWORD (leader changes own) ====================
exports.changeOwnPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const leader = await Leader.findById(req.params.id).select('+password');
    if (!leader) return res.status(404).json({ error: 'Leader not found' });

    const isMatch = await leader.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

    leader.password = newPassword;
    leader.mustChangePassword = false;
    leader.passwordChangedAt = new Date();
    await leader.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};