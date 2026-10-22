const WithdrawalSettings = require('../models/WithdrawalSettings');

// ==================== MONTH NAME HELPER ====================
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const monthName = (n) => MONTH_NAMES[Number(n) || 1] || '';

// ==================== DEFAULT SETTINGS (fallback) ====================
const DEFAULTS = {
  juneEnabled: true,
  juneMonth: 6,
  juneStartDay: 15,
  juneEndDay: 30,
  decemberEnabled: true,
  decemberMonth: 12,
  decemberStartDay: 15,
  decemberEndDay: 30,
  dividendWindowEnabled: true,
  dividendStartMonth: 12,
  dividendStartDay: 1,
  dividendEndMonth: 12,
  dividendEndDay: 31,
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

// ==================== SAVINGS WINDOW CHECK ====================
function isWithinWindow(date = new Date(), settings) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const s = settings || DEFAULTS;

  const m1 = Number(s.juneMonth) || 6;
  const m2 = Number(s.decemberMonth) || 12;

  if (s.juneEnabled && month === m1 && day >= s.juneStartDay && day <= s.juneEndDay) {
    return { ok: true, period: 'window1' };
  }
  if (s.decemberEnabled && month === m2 && day >= s.decemberStartDay && day <= s.decemberEndDay) {
    return { ok: true, period: 'window2' };
  }
  return { ok: false, period: null };
}

// ==================== DIVIDEND WINDOW CHECK ====================
// Supports windows that span across month boundaries (e.g. Dec 15 → Jan 15)
function isWithinDividendWindow(date = new Date(), settings) {
  const s = settings || DEFAULTS;
  if (!s.dividendWindowEnabled) return { ok: false, period: null };

  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const startM = Number(s.dividendStartMonth) || 12;
  const startD = Number(s.dividendStartDay) || 1;
  const endM = Number(s.dividendEndMonth) || 12;
  const endD = Number(s.dividendEndDay) || 31;

  // Same-month window (start ≤ end in same month)
  if (startM === endM) {
    if (month === startM && day >= startD && day <= endD) {
      return { ok: true, period: 'dividend_window' };
    }
    return { ok: false, period: null };
  }

  // Cross-year window (start in later month, end in earlier month — e.g. Dec → Jan)
  if (startM > endM) {
    if ((month === startM && day >= startD) || (month === endM && day <= endD) || (month > startM) || (month < endM)) {
      // Only allow months strictly between or in the range
      if (month === startM) return { ok: day >= startD, period: 'dividend_window' };
      if (month === endM) return { ok: day <= endD, period: 'dividend_window' };
      if (month > startM || month < endM) return { ok: true, period: 'dividend_window' };
      return { ok: false, period: null };
    }
    return { ok: false, period: null };
  }

  // Same-year normal window (start month < end month)
  if (month === startM) return { ok: day >= startD, period: 'dividend_window' };
  if (month === endM) return { ok: day <= endD, period: 'dividend_window' };
  if (month > startM && month < endM) return { ok: true, period: 'dividend_window' };
  return { ok: false, period: null };
}

// ==================== WINDOW INFO (for UI) ====================
function getWithdrawalWindow(date = new Date(), settings) {
  const s = settings || DEFAULTS;
  return {
    window1: {
      enabled: s.juneEnabled,
      month: Number(s.juneMonth) || 6,
      monthName: monthName(s.juneMonth || 6),
      startDay: s.juneStartDay,
      endDay: s.juneEndDay,
      label: `${monthName(s.juneMonth || 6)} ${s.juneStartDay}–${s.juneEndDay}`
    },
    window2: {
      enabled: s.decemberEnabled,
      month: Number(s.decemberMonth) || 12,
      monthName: monthName(s.decemberMonth || 12),
      startDay: s.decemberStartDay,
      endDay: s.decemberEndDay,
      label: `${monthName(s.decemberMonth || 12)} ${s.decemberStartDay}–${s.decemberEndDay}`
    }
  };
}

// ==================== DIVIDEND WINDOW LABEL ====================
function getDividendWindowLabel(settings) {
  const s = settings || DEFAULTS;
  if (!s.dividendWindowEnabled) return 'disabled';
  const start = `${monthName(s.dividendStartMonth || 12)} ${s.dividendStartDay || 1}`;
  const end = `${monthName(s.dividendEndMonth || 12)} ${s.dividendEndDay || 31}`;
  return `${start} – ${end}`;
}

// ==================== ELIGIBILITY CHECK ====================
function checkEligibility(member, source, requestedAmount, date = new Date(), settings, options = {}) {
  const s = settings || DEFAULTS;
  const { allowOverride = false, overrideReason = '' } = options;

  // Pick the right window based on source
  const window = source === 'dividends'
    ? isWithinDividendWindow(date, s)
    : isWithinWindow(date, s);

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
      reason: source === 'dividends'
        ? `Dividend withdrawals are only allowed ${getDividendWindowLabel(s)}.`
        : `Withdrawals are only allowed ${getWindowLabel(s)}.`,
      period: null
    };
  }

  // Active loan check (only for savings; dividends exempt)
  if (source === 'savings' && s.blockOnActiveLoan && member.activeLoanId) {
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
  if (s.juneEnabled) parts.push(`${monthName(s.juneMonth || 6)} ${s.juneStartDay}–${s.juneEndDay}`);
  if (s.decemberEnabled) parts.push(`${monthName(s.decemberMonth || 12)} ${s.decemberStartDay}–${s.decemberEndDay}`);
  return parts.length > 0 ? parts.join(' and ') : 'not currently';
}

module.exports = {
  getSettings,
  isWithinWindow,
  isWithinDividendWindow,
  getWithdrawalWindow,
  getDividendWindowLabel,
  checkEligibility,
  getWindowLabel,
  DEFAULTS
};