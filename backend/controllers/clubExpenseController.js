const ClubExpense = require('../models/ClubExpense');
const PaymentVoucher = require('../models/PaymentVoucher');
const { createJournalEntry } = require('../utils/journalHelper');
const { generateVoucherNumber } = require('../utils/voucherNumber');

// ==================== CREATE CLUB EXPENSE (single or multi) ====================
exports.createExpense = async (req, res) => {
  try {
    const {
      description,
      amount,
      category,
      date,
      paidTo,
      payee,
      cashier,
      receiptImage,
      createdBy,
      items,
      notes,
      batchId
    } = req.body;

    const expDate = date ? new Date(date) : new Date();
    const finalBatchId = batchId || `BATCH-${Date.now()}`;

    // ==================== MULTI-ENTRY MODE ====================
    if (items && Array.isArray(items) && items.length > 0) {
      const createdExpenses = [];
      const voucherLines = [];
      let grandTotal = 0;
      let voucherPayee = payee || '';
      let voucherCashier = cashier || '';

      for (const item of items) {
        const itemAmount = Number(item.amount) || 0;
        if (itemAmount <= 0) continue;

        const exp = await ClubExpense.create({
          description: item.description || 'Expense',
          amount: itemAmount,
          category: item.category || 'other',
          date: expDate,
          paidTo: item.payee || payee || '',
          payee: item.payee || payee || '',
          cashier: item.cashier || cashier || '',
          receiptImage: item.receiptImage || receiptImage || '',
          batchId: finalBatchId,
          createdBy: createdBy || 'admin'
        });

        try {
          const journal = await createJournalEntry({
            date: expDate,
            description: `Club expense: ${exp.description}`,
            reference: exp._id.toString(),
            sourceType: 'club_expense',
            lines: [
              { accountCode: '4010', debit: itemAmount },
              { accountCode: '1000', credit: itemAmount }
            ],
            createdBy: createdBy || 'admin'
          });
          exp.journalEntryId = journal._id;
          await exp.save();
        } catch (e) { console.error('Journal error:', e.message); }

        createdExpenses.push(exp);
        grandTotal += itemAmount;
        voucherLines.push({
          description: exp.description,
          category: exp.category,
          amount: itemAmount,
          sourceModel: 'ClubExpense',
          sourceId: exp._id
        });

        if (!voucherPayee && exp.payee) voucherPayee = exp.payee;
        if (!voucherCashier && exp.cashier) voucherCashier = exp.cashier;
      }

      if (createdExpenses.length === 0) {
        return res.status(400).json({ error: 'No valid items with amounts provided' });
      }

      let voucher = null;
      if (voucherPayee) {
        let voucherNumber;
        try {
          voucherNumber = await generateVoucherNumber(expDate);
        } catch (err) {
          voucherNumber = await generateVoucherNumber(expDate);
        }

        voucher = await PaymentVoucher.create({
          voucherNumber,
          voucherFor: 'club',
          payee: voucherPayee,
          cashier: voucherCashier,
          lineItems: voucherLines,
          totalAmount: grandTotal,
          batchId: finalBatchId,
          date: expDate,
          notes: notes || '',
          receiptImage: receiptImage || '',
          issuedBy: createdBy || 'admin'
        });

        await ClubExpense.updateMany(
          { _id: { $in: createdExpenses.map(e => e._id) } },
          { $set: { voucherId: voucher._id } }
        );
      }

      return res.status(201).json({
        success: true,
        message: `${createdExpenses.length} expense(s) recorded${voucher ? `, voucher ${voucher.voucherNumber} generated` : ''}`,
        expenses: createdExpenses,
        voucher
      });
    }

    // ==================== SINGLE-ENTRY MODE ====================
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const expense = await ClubExpense.create({
      description,
      amount: Number(amount),
      category: category || 'other',
      date: expDate,
      paidTo: paidTo || payee || '',
      payee: payee || paidTo || '',
      cashier: cashier || '',
      receiptImage: receiptImage || '',
      batchId: finalBatchId,
      createdBy: createdBy || 'admin'
    });

    try {
      const journal = await createJournalEntry({
        date: expDate,
        description: `Club expense: ${description}`,
        reference: expense._id.toString(),
        sourceType: 'club_expense',
        lines: [
          { accountCode: '4010', debit: Number(amount) },
          { accountCode: '1000', credit: Number(amount) }
        ],
        createdBy: createdBy || 'admin'
      });
      expense.journalEntryId = journal._id;
      await expense.save();
    } catch (e) { console.error('Journal error:', e.message); }

    let voucher = null;
    if (expense.payee) {
      let voucherNumber;
      try {
        voucherNumber = await generateVoucherNumber(expDate);
      } catch (err) {
        voucherNumber = await generateVoucherNumber(expDate);
      }

      voucher = await PaymentVoucher.create({
        voucherNumber,
        voucherFor: 'club',
        payee: expense.payee,
        cashier: expense.cashier,
        lineItems: [{
          description: expense.description,
          category: expense.category,
          amount: expense.amount,
          sourceModel: 'ClubExpense',
          sourceId: expense._id
        }],
        totalAmount: expense.amount,
        batchId: finalBatchId,
        date: expDate,
        receiptImage: expense.receiptImage,
        issuedBy: createdBy || 'admin'
      });

      expense.voucherId = voucher._id;
      await expense.save();
    }

    res.status(201).json({ success: true, expense, voucher });
  } catch (error) {
    console.error('CREATE EXPENSE ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET ALL EXPENSES ====================
exports.getAllExpenses = async (req, res) => {
  try {
    const { month, year, category, startDate, endDate, search } = req.query;
    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (category) filter.category = category;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { payee: { $regex: search, $options: 'i' } },
        { paidTo: { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await ClubExpense.find(filter).sort('-date').limit(500);
    const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    res.json({ expenses, total, count: expenses.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET CATEGORY TOTALS ====================
exports.getCategoryTotals = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = {};
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const expenses = await ClubExpense.find(filter);

    const totals = {};
    let grandTotal = 0;
    for (const e of expenses) {
      const cat = e.category || 'other';
      totals[cat] = (totals[cat] || 0) + Number(e.amount || 0);
      grandTotal += Number(e.amount || 0);
    }

    const result = Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    res.json({ byCategory: result, grandTotal, count: expenses.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getExpenseById = async (req, res) => {
  try {
    const expense = await ClubExpense.findById(req.params.id).populate('voucherId');
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DELETE EXPENSE (with journal reversal) ====================
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await ClubExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // 1. Reverse the journal — Debit Club Capital / Credit Club Expenses
    try {
      await createJournalEntry({
        date: new Date(),
        description: `REVERSAL of club expense: ${expense.description} (deleted)`,
        reference: expense._id.toString(),
        sourceType: 'club_expense',
        lines: [
          { accountCode: '1000', debit: Number(expense.amount) },   // restore Club Capital
          { accountCode: '4010', credit: Number(expense.amount) }   // reverse the expense
        ],
        createdBy: req.body?.deletedBy || 'admin'
      });
    } catch (e) {
      console.error('Reversal journal error:', e.message);
      return res.status(500).json({ error: 'Failed to reverse journal: ' + e.message });
    }

    // 2. If the expense has a linked voucher, soft-delete it too
    if (expense.voucherId) {
      const voucher = await PaymentVoucher.findById(expense.voucherId);
      if (voucher && voucher.status !== 'deleted') {
        // Check if this voucher covers only this expense
        const otherExpenses = await ClubExpense.countDocuments({
          _id: { $ne: expense._id },
          voucherId: expense.voucherId
        });
        // If no other expenses use this voucher, delete it
        if (otherExpenses === 0) {
          voucher.status = 'deleted';
          voucher.deletedReason = `Parent expense deleted: ${expense.description}`;
          voucher.deletedAt = new Date();
          voucher.deletedBy = req.body?.deletedBy || 'admin';
          await voucher.save();
        }
      }
    }

    // 3. Delete the expense record
    await ClubExpense.findByIdAndDelete(expense._id);

    res.json({
      success: true,
      message: `Expense "${expense.description}" (UGX ${Number(expense.amount).toLocaleString()}) deleted. Club Capital restored.`,
      restoredAmount: expense.amount
    });
  } catch (error) {
    console.error('DELETE EXPENSE ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};