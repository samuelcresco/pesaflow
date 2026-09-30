const Setting = require('../models/Setting');
const ShareSettings = require('../models/shareSettings.models');

// ==================== LOAN SETTINGS ====================
exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
 processingFeeEmergency: 0,
        processingFeeSchoolFees: 0,
        processingFeeBusiness: 0,
        latePenaltyEmergency: 0,
        latePenaltySchoolFees: 0,
        latePenaltyBusiness: 0,
        loanLimitPercent: 70,
        emergencyInterest: 5,
        schoolFeesInterest: 8,
        businessInterest: 10,
        emergencyDurationMonths: 1,
        schoolFeesDefaultMonths: 3,
        businessDefaultMonths: 6,
        dividendPlatinumPercent: 40,
        dividendGoldenPercent: 30,
        dividendSilverPercent: 20,
        dividendBronzePercent: 10,
        monthlySavingsAmount: 0,
        membershipFeeAmount: 0
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) settings = new Setting();
    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== SHARE SETTINGS ====================
exports.getShareSettings = async (req, res) => {
  try {
    let settings = await ShareSettings.findOne();
    if (!settings) {
      settings = await ShareSettings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateShareSettings = async (req, res) => {
  try {
    let settings = await ShareSettings.findOne();
    if (!settings) {
      settings = new ShareSettings(req.body);
    } else {
      if (req.body.shareTypes) {
        settings.shareTypes = { ...settings.shareTypes, ...req.body.shareTypes };
      }
      if (req.body.dividendPercentages) {
        // Validate: percentages must sum to 100
        const p = req.body.dividendPercentages;
        const total = (p.ordinary || 0) + (p.silver || 0) + (p.golden || 0) + (p.platinum || 0);
        if (Math.abs(total - 100) > 0.01) {
          return res.status(400).json({ error: `Dividend percentages must total 100%. Currently: ${total}%` });
        }
        settings.dividendPercentages = { ...settings.dividendPercentages, ...p };
      }
      if (req.body.loanEligibility) {
        settings.loanEligibility = { ...settings.loanEligibility, ...req.body.loanEligibility };
      }
      if (req.body.updatedBy) settings.updatedBy = req.body.updatedBy;
      settings.updatedAt = new Date();
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== PUBLIC ELIGIBILITY (used on loan form) ====================
exports.getLoanEligibilityText = async (req, res) => {
  try {
    const settings = await ShareSettings.findOne();
    if (!settings) return res.json({ emergency: '', school_fees: '', business: '' });
    res.json(settings.loanEligibility || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};