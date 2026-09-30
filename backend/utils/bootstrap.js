const Business = require('../models/Business');
const Account = require('../models/Account');

async function bootstrap() {
  try {
    const accountsToSeed = [
      { code: '1000', name: 'Club Capital', type: 'Equity', category: 'club' },
      { code: '1010', name: 'Member Savings', type: 'Equity', category: 'member' },
      { code: '1100', name: 'Loan Business Fund', type: 'Asset', category: 'loan' },
      { code: '1105', name: 'Interest Fund', type: 'Asset', category: 'interest' },
      { code: '1200', name: 'Club Investments', type: 'Asset', category: 'investment' },
      { code: '2000', name: 'Dividends Payable', type: 'Liability', category: 'dividend' },
      { code: '3000', name: 'Revenue - Loan Interest', type: 'Revenue', category: 'loan' },
      { code: '3010', name: 'Revenue - Business', type: 'Revenue', category: 'business' },
      { code: '4000', name: 'Business Expenses', type: 'Expense', category: 'business' },
      { code: '4010', name: 'Club Expenses', type: 'Expense', category: 'club' },
      { code: '4020', name: 'Losses', type: 'Expense', category: 'loss' },
      { code: '5000', name: 'Dividend Distribution', type: 'Equity', category: 'dividend' }
    ];

    for (const acc of accountsToSeed) {
      const exists = await Account.findOne({ code: acc.code });
      if (!exists) {
        await Account.create(acc);
        console.log('✅ Created account:', acc.code, '-', acc.name);
      }
    }

    let loanBusiness = await Business.findOne({ isSystem: true, type: 'loan' });
    if (!loanBusiness) {
      loanBusiness = await Business.create({
        name: 'Loans (Investment)',
        description: 'Loan disbursements, repayments and interest (system business)',
        type: 'loan',
        isSystem: true,
        fundAccountCode: '1100',
        interestAccountCode: '1105',
        createdBy: 'system'
      });
      console.log('✅ Loan Business created');
    } else {
      if (!loanBusiness.interestAccountCode) {
        loanBusiness.interestAccountCode = '1105';
        await loanBusiness.save();
      }
      console.log('✅ Loan Business already exists');
    }

    console.log('✅ Bootstrap complete');
  } catch (error) {
    console.error('❌ Bootstrap error:', error.message);
  }
}

module.exports = bootstrap;