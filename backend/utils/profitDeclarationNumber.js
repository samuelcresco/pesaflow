const ProfitDeclaration = require('../models/ProfitDeclaration');

async function generateDeclarationNumber(date = new Date()) {
  const year = new Date(date).getFullYear();
  const prefix = `PD-${year}-`;

  const last = await ProfitDeclaration.findOne({
    declarationNumber: { $regex: `^${prefix}` }
  }).sort({ declarationNumber: -1 }).lean();

  let nextSeq = 1;
  if (last?.declarationNumber) {
    const parts = last.declarationNumber.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

module.exports = { generateDeclarationNumber };