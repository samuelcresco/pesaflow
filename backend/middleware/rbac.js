const Leader = require('../models/Leader');

// ==================== CARD ACCESS MAP ====================
const PATH_TO_CARD = {
  '/api/members': 'members',
  '/api/savings': 'savings',
  '/api/loans': 'loans',
  '/api/withdrawals': 'withdrawals',
  '/api/receipts': 'receipts',
  '/api/statements': 'statements',
  '/api/business': 'business',
  '/api/dividends': 'dividends',
  '/api/investments': 'investments',
  '/api/expenses': 'expenses',
  '/api/club-expenses': 'expenses',
  '/api/reports': 'reports',
  '/api/settings': 'share-settings',
  '/api/leaders': 'leaders',
  '/api/club-profile': 'club-profile',
  '/api/delivery-notes': 'delivery-notes',
  '/api/share-certificates': 'share-settings',
  '/api/transactions': 'reports',
  '/api/member': 'members'
};

// ==================== PUBLIC ROUTES (no auth required) ====================
const PUBLIC_PREFIXES = [
  '/api/admin/login',
  '/api/admin/setup',
  '/api/admin/reset-password',
  '/api/leaders/login',
  '/api/member/login',
  '/api/member/forgot-password',
  '/api/member/club-stats',
  '/api/member/leaders',
  '/api/receipts/verify',
  '/api/share-certificates/verify',
  '/api/expenses/vouchers/verify',
  '/api/business/sales/verify',
  '/api/delivery-notes/verify',
  '/health'
];

function isPublic(path) {
  return PUBLIC_PREFIXES.some(p => path.startsWith(p));
}

function getCardForPath(path) {
  const matches = Object.keys(PATH_TO_CARD).filter(p => path.startsWith(p));
  if (matches.length === 0) return null;
  return PATH_TO_CARD[matches.sort((a, b) => b.length - a.length)[0]];
}

// ==================== AUTH MIDDLEWARE ====================
async function authenticate(req, res, next) {
  try {
    // req.originalUrl includes the /api prefix (since this middleware is mounted at /api)
    const path = (req.originalUrl || req.url || '').split('?')[0];

    // Public routes always pass
    if (isPublic(path)) {
      req.user = { isPublic: true };
      return next();
    }

    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    // No identity provided → allow through (backwards compat for any unmigrated client)
    if (!userId || !userRole) {
      req.user = { isAnonymous: true };
      return next();
    }

    // Admin / IT technician → full access
    if (userRole === 'admin' || userRole === 'it_technician') {
      req.user = { id: userId, role: userRole, isAdmin: true };
      return next();
    }

    // Member portal → member is authenticated by their own login flow
    if (userRole === 'member') {
      req.user = { id: userId, role: 'member' };
      return next();
    }

    // Leader → check their cardAccess
    const leader = await Leader.findById(userId).lean();
    if (!leader) {
      return res.status(401).json({ error: 'Session invalid. Please log in again.' });
    }
    if (!leader.active) {
      return res.status(401).json({ error: 'Account is inactive.' });
    }

    const requiredCard = getCardForPath(path);

    // If no card maps to this path, allow (e.g. /api/leaders/card-defaults)
    if (!requiredCard) {
      req.user = { id: userId, role: userRole, leader };
      return next();
    }

    // Check access
    const hasAccess = (leader.cardAccess || []).includes(requiredCard);
    if (!hasAccess) {
      return res.status(403).json({
        error: `Access denied. Your role does not have access to "${requiredCard}".`,
        requiredCard
      });
    }

    req.user = { id: userId, role: userRole, leader };
    next();
  } catch (error) {
    console.error('AUTH MIDDLEWARE ERROR:', error.message);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// ==================== ROLE GUARD (for future use) ====================
function requireCard(cardId) {
  return (req, res, next) => {
    if (req.user?.isAdmin) return next();
    if (req.user?.isPublic || req.user?.isAnonymous) return next();
    if (req.user?.role === 'member') return next();
    if (req.user?.leader && (req.user.leader.cardAccess || []).includes(cardId)) {
      return next();
    }
    res.status(403).json({ error: `Access denied. Requires "${cardId}" access.` });
  };
}

// ==================== LOAN ACTION GUARD ====================
function requireLoanAction(action) {
  return (req, res, next) => {
    if (req.user?.isAdmin) return next();
    if (req.user?.isPublic || req.user?.isAnonymous) return next();

    const role = req.user?.role;
    const allowed = {
      apply: ['loan_officer_1', 'loan_officer_2', 'chairman_loan_committee'],
      approve: ['chairman_loan_committee'],
      reject: ['chairman_loan_committee'],
      disburse: ['treasurer'],
      close: ['treasurer', 'treasurer_loan_committee'],
      mark_paid: ['loan_officer_1', 'loan_officer_2', 'treasurer', 'treasurer_loan_committee']
    };

    if (!allowed[action] || !allowed[action].includes(role)) {
      return res.status(403).json({
        error: `Access denied. Only ${allowed[action]?.join(', ')} can perform "${action}".`
      });
    }
    next();
  };
}

module.exports = { authenticate, requireCard, requireLoanAction };