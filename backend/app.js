require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');

// CHANGED 'MONGO_URI' to 'MONGODB_URI' to match your .env file
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pesaflow')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Role'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ==================== AUTHENTICATION ====================
const { authenticate } = require('./middleware/rbac');
app.use('/api', authenticate);

// ==================== ROUTES ====================
const membersRoutes = require('./routes/members.routes');
app.use('/api/members', membersRoutes);
const adminRoutes = require('./routes/admin.routes');
app.use('/api/admin', adminRoutes);
const savingsRoutes = require('./routes/savings.routes');
app.use('/api/savings', savingsRoutes);
const settingsRoutes = require('./routes/settings.routes');
app.use('/api/settings', settingsRoutes);
const loansRoutes = require('./routes/loans.routes');
app.use('/api/loans', loansRoutes);
const businessRoutes = require('./routes/business.routes');
app.use('/api/business', businessRoutes);
const dividendRoutes = require('./routes/dividend.routes');
app.use('/api/dividends', dividendRoutes);
const memberPortalRoutes = require('./routes/memberPortal.routes');
app.use('/api/member', memberPortalRoutes);
const leaderRoutes = require('./routes/leader.routes');
app.use('/api/leaders', leaderRoutes);
const investmentRoutes = require('./routes/investment.routes');
app.use('/api/investments', investmentRoutes);
const clubExpenseRoutes = require('./routes/clubExpense.routes');
app.use('/api/club-expenses', clubExpenseRoutes);
const reportRoutes = require('./routes/report.routes');
app.use('/api/reports', reportRoutes);
const receiptRoutes = require('./routes/receipt.routes');
app.use('/api/receipts', receiptRoutes);
const clubProfileRoutes = require('./routes/clubProfile.routes');
app.use('/api/club-profile', clubProfileRoutes);
const withdrawalRoutes = require('./routes/withdrawal.routes');
app.use('/api/withdrawals', withdrawalRoutes);
const transactionRoutes = require('./routes/transaction.routes');
app.use('/api/transactions', transactionRoutes);
const shareCertificateRoutes = require('./routes/shareCertificate.routes');
app.use('/api/share-certificates', shareCertificateRoutes);
const expensesRoutes = require('./routes/expenses.routes');
app.use('/api/expenses', expensesRoutes);
const deliveryNoteRoutes = require('./routes/deliveryNote.routes');
app.use('/api/delivery-notes', deliveryNoteRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'PesaFlow backend running' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const bootstrap = require('./utils/bootstrap');

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ Also accessible at http://<your-lan-ip>:${PORT}`);
  await bootstrap();
});