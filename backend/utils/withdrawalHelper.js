const WithdrawalSettings = require('../models/WithdrawalSettings');

// ==================== DEFAULT SETTINGS (fallback) ====================
const DEFAULTS = {
  juneEnabled: true,
  juneStartDay: 15,
  juneEndDay: 30,
  decemberEnabled: true,
  decemberStartDay: 15,
  decemberEndDay: 30,
  savingsCapPercent: 20,
  blockOnActiveLoan: true,
  allowOverride: true
};

// ==================== LOAD SETTINGS ====================
async function getSettings() {
  try {
    let s = await WithdrawalSettings.findOne();
    if (!s) s = await WithdrawalSettings.create(DEFAULTS);
    return s;
  } catch (err) {
    console.error('Withdrawal settings load error:', err.message);
    return DEFAULTS;
  }
}

// ==================== WINDOW CHECK ====================
// Returns { ok: true, period: 'june' | 'december' } or { ok: false, period: null }
function isWithinWindow(date = new Date(), settings) {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const s = settings || DEFAULTS;

  if (s.juneEnabled && month === 6 && day >= s.juneStartDay && day <= s.juneEndDay) {
    return { ok: true, period: 'june' };
  }
  if (s.decemberEnabled && month === 12 && day >= s.decemberStartDay && day <= s.decemberEndDay) {
    return { ok: true, period: 'december' };
  }
  return { ok: false, period: null };
}

// ==================== WINDOW INFO (for UI) ====================
function getWithdrawalWindow(date = new Date(), settings) {
  const s = settings || DEFAULTS;
  return {
    june: {
      enabled: s.juneEnabled,
      startDay: s.juneStartDay,
      endDay: s.juneEndDay,
      label: `June ${s.juneStartDay}–${s.juneEndDay}`
    },
    december: {
      enabled: s.decemberEnabled,
      startDay: s.decemberStartDay,
      endDay: s.decemberEndDay,
      label: `December ${s.decemberStartDay}–${s.decemberEndDay}`
    }
  };
}

// ==================== ELIGIBILITY CHECK ====================
function checkEligibility(member, source, requestedAmount, date = new Date(), settings, options = {}) {
  const s = settings || DEFAULTS;
  const { allowOverride = false, overrideReason = '' } = options;
  const window = isWithinWindow(date, s);

  // Window check (can be overridden)
  let windowOk = window.ok;
  let overrideUsed = false;

  if (!windowOk && allowOverride && s.allowOverride) {
    if (!overrideReason || !overrideReason.trim()) {
      return {
        eligible: false,
        reason: 'Override reason is required when withdrawing outside the allowed window.',
        period: null,
        requiresOverrideReason: true
      };
    }
    windowOk = true;
    overrideUsed = true;
  }

  if (!windowOk) {
    return {
      eligible: false,
      reason: `Withdrawals are only allowed ${getWindowLabel(s)}.`,
      period: null
    };
  }

  // Active loan check
  if (s.blockOnActiveLoan && member.activeLoanId) {
    return {
      eligible: false,
      reason: 'Cannot withdraw while a loan is active. Savings are closed.',
      period: window.period || 'override'
    };
  }

  const savings = Number(member.savings) || 0;
  const dividends = Number(member.dividendBalance) || 0;
  const amount = Number(requestedAmount) || 0;

  if (source === 'savings') {
    const cap = Math.floor(savings * (s.savingsCapPercent / 100));
    if (amount > cap) {
      return {
        eligible: false,
        reason: `Max withdrawal from savings is ${s.savingsCapPercent}% (UGX ${cap.toLocaleString()})`,
        period: window.period || 'override',
        cap
      };
    }
    if (amount > savings) {
      return {
        eligible: false,
        reason: `Insufficient savings. Available: UGX ${savings.toLocaleString()}`,
        period: window.period || 'override'
      };
    }
    return {
      eligible: true,
      period: window.period || 'override',
      cap,
      available: savings,
      maxWithdrawable: cap,
      overrideUsed
    };
  }

  if (source === 'dividends') {
    if (amount > dividends) {
      return {
        eligible: false,
        reason: `Insufficient dividends. Available: UGX ${dividends.toLocaleString()}`,
        period: window.period || 'override'
      };
    }
    return {
      eligible: true,
      period: window.period || 'override',
      cap: null,
      available: dividends,
      maxWithdrawable: dividends,
      overrideUsed
    };
  }

  return {
    eligible: false,
    reason: 'Invalid withdrawal source',
    period: window.period || null
  };
}

// ==================== WINDOW LABEL HELPER ====================
function getWindowLabel(s) {
  const parts = [];
  if (s.juneEnabled) parts.push(`June ${s.juneStartDay}–${s.juneEndDay}`);
  if (s.decemberEnabled) parts.push(`December ${s.decemberStartDay}–${s.decemberEndDay}`);
  return parts.length > 0 ? parts.join(' and ') : 'not currently';
}

module.exports = {
  getSettings,
  isWithinWindow,
  getWithdrawalWindow,
  checkEligibility,
  getWindowLabel,
  DEFAULTS
};