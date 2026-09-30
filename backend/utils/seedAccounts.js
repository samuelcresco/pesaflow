const Account = require('../models/Account');

const defaultAccounts = [
  { code: '1000', name: 'Club Capital', type: 'Equity', category: 'club' },
  { code: '1010', name: 'Member Savings', type: 'Equity', category: 'member' },
  { code: '1100', name: 'Loan Business Fund', type: 'Asset', category: 'loan' },
  { code: '1150', name: 'Loans Receivable', type: 'Asset', category: 'loan' },
  { code: '1200', name: 'Club Investments', type: 'Asset', category: 'investment' },
  { code: '1300', name: 'Interest Fund', type: 'Asset', category: 'loan' },
  { code: '1400', name: 'Consolidated Profit Pool', type: 'Asset', category: 'profit_pool' },
  { code: '2000', name: 'Dividends Payable', type: 'Liability', category: 'dividend' },
  { code: '3000', name: 'Revenue - Loan Interest', type: 'Revenue', category: 'loan' },
  { code: '3010', name: 'Revenue - Business', type: 'Revenue', category: 'business' },
  { code: '4000', name: 'Business Expenses', type: 'Expense', category: 'business' },
  { code: '4010', name: 'Club Expenses', type: 'Expense', category: 'club' },
  { code: '4020', name: 'Losses', type: 'Expense', category: 'loss' },
  { code: '5000', name: 'Dividend Distribution', type: 'Equity', category: 'dividend' }
];

async function seedAccounts() {
  try {
    for (const acc of defaultAccounts) {
      const exists = await Account.findOne({ code: acc.code });
      if (!exists) {
        await Account.create(acc);
        console.log(`✅ Created account: ${acc.code} - ${acc.name}`);
      }
    }
    console.log('✅ Chart of Accounts seeded');
  } catch (error) {
    console.error('Seeding error:', error.message);
  }
}

module.exports = seedAccounts;