const Leader = require('../models/Leader');
const Member = require('../models/Member');

// Helper to find a leader's signature from their Member profile
async function getLeaderSignature(role) {
  // 1. Find the active leader for this role
  const leader = await Leader.findOne({ role, active: true }).sort('order');
  if (!leader) return null;

  // 2. Find the matching Member profile
  let member = null;
  
  if (leader.contact || leader.email) {
    member = await Member.findOne({
      $or: [
        { contact: leader.contact },
        { email: leader.email }
      ]
    });
  }

  // 3. Fallback to name matching if not found by contact/email
  if (!member && leader.name) {
    const parts = leader.name.trim().split(' ');
    if (parts.length >= 2) {
      const firstName = parts[0];
      const surname = parts.slice(1).join(' ');
      member = await Member.findOne({ firstName, surname });
    }
  }

  // 4. Return the Member's signature, or the Leader's own signature, or null
  const signature = member?.signature || leader.signature || null;
  
  if (!signature || typeof signature !== 'string' || !signature.startsWith('data:image')) {
    return null;
  }
  
  try {
    return Buffer.from(signature.split(',')[1], 'base64');
  } catch (err) {
    return null;
  }
}

module.exports = { getLeaderSignature };