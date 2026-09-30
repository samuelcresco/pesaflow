
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Business = require('../models/Business');
const BusinessTransaction = require('../models/BusinessTransaction');
const Account = require('../models/Account');
const { createJournalEntry } = require('../utils/journalHelper');
const { generateSaleReceiptNumber } = require('../utils/saleReceiptNumber');
const { generateSaleReceiptPDF } = require('../utils/saleReceiptPDF');

const fmt = (n) => Number(n || 0).toLocaleString('en-UG');

// ==================== CREATE SALE ====================
exports.createSale = async (req, res) => {
  try {
    const {
      businessId,
      customerName,
      customerContact,
      items,
      discount,
      paymentMethod,
      paymentReference,
      amountPaid,
      soldBy,
      date,
      notes
    } = req.body;

    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!customerName || !customerName.trim()) return res.status(400).json({ error: 'Customer name is required' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item required' });

    const biz = await Business.findById(businessId);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const saleDate = date ? new Date(date) : new Date();

    // Validate + prepare items
    const preparedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      let unitPrice = Number(item.unitPrice) || 0;
      let productName = item.productName || '';

      // If productId provided, pull price + name + check stock
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          unitPrice = unitPrice || product.price;
          productName = productName || product.name;

          // Stock check
          if (product.trackStock && product.stock < qty) {
            return res.status(400).json({
              error: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${qty}`
            });
          }
        }
      }

      if (!productName) return res.status(400).json({ error: 'Item name required' });
      if (unitPrice <= 0) return res.status(400).json({ error: `Price required for ${productName}` });

      const lineTotal = qty * unitPrice;
      preparedItems.push({
        productId: item.productId || null,
        productName,
        quantity: qty,
        unitPrice,
        lineTotal
      });
      subtotal += lineTotal;
    }

    if (preparedItems.length === 0) return res.status(400).json({ error: 'No valid items' });

    const discountAmount = Number(discount) || 0;
    const total = Math.max(0, subtotal - discountAmount);
    const paid = amountPaid !== undefined ? Number(amountPaid) : total;
    const balance = Math.max(0, total - paid);

    let paymentStatus = 'paid';
    if (paid <= 0) paymentStatus = 'unpaid';
    else if (paid < total) paymentStatus = 'partial';

    // Generate receipt number
    let receiptNumber;
    try {
      receiptNumber = await generateSaleReceiptNumber(saleDate);
    } catch (err) {
      receiptNumber = await generateSaleReceiptNumber(saleDate);
    }

    const sale = await Sale.create({
      receiptNumber,
      businessId,
      businessName: biz.name,
      customerName: customerName.trim(),
      customerContact: customerContact || '',
      items: preparedItems,
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod: paymentMethod || 'cash',
      paymentReference: paymentReference || '',
      paymentStatus,
      amountPaid: paid,
      balanceOwed: balance,
      soldBy: soldBy || 'admin',
      notes: notes || '',
      date: saleDate
    });

    // Reduce stock if tracking
    for (const item of preparedItems) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product && product.trackStock) {
          product.stock = Math.max(0, product.stock - item.quantity);
          await product.save();
        }
      }
    }

    // Record revenue in BusinessTransaction
    const bizTxn = await BusinessTransaction.create({
      businessId,
      type: 'revenue',
      amount: total,
      description: `Sale ${receiptNumber} — ${customerName}${preparedItems.length > 1 ? ` (${preparedItems.length} items)` : ` (${preparedItems[0].productName})`}`,
      reference: sale._id.toString(),
      date: saleDate,
      createdBy: soldBy || 'admin'
    });

    // Journal: Debit Business Fund / Credit Revenue - Business
    try {
      const journal = await createJournalEntry({
        date: saleDate,
        description: `Sale ${receiptNumber} — ${biz.name}`,
        reference: sale._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: biz.fundAccountCode || '1100', debit: total },
          { accountCode: '3010', credit: total }
        ],
        createdBy: soldBy || 'admin'
      });
      sale.journalEntryId = journal._id;
      sale.businessTransactionId = bizTxn._id;
      await sale.save();
    } catch (e) { console.error('Journal error:', e.message); }

    // Update business balance
    biz.currentBalance = (Number(biz.currentBalance) || 0) + total;
    await biz.save();

    res.status(201).json({ success: true, sale });
  } catch (error) {
    console.error('CREATE SALE ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET SALES BY BUSINESS ====================
exports.getSalesByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate, customer, search, status } = req.query;
    const filter = { businessId };
    if (status) filter.status = status;
    else filter.status = 'active';

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (customer) filter.customerName = { $regex: customer, $options: 'i' };
    if (search) {
      filter.$or = [
        { receiptNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerContact: { $regex: search, $options: 'i' } }
      ];
    }

    const sales = await Sale.find(filter).sort('-date').limit(500);
    const totalRevenue = sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalUnpaid = sales.filter(s => s.paymentStatus !== 'paid').reduce((s, x) => s + Number(x.balanceOwed || 0), 0);

    res.json({ sales, count: sales.length, totalRevenue, totalUnpaid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== VERIFY (public for QR) ====================
exports.verifySale = async (req, res) => {
  try {
    const sale = await Sale.findOne({ receiptNumber: req.params.number });
    if (!sale) return res.status(404).json({ valid: false, error: 'Sale not found' });
    res.json({
      valid: sale.status === 'active',
      status: sale.status,
      receiptNumber: sale.receiptNumber,
      businessName: sale.businessName,
      customerName: sale.customerName,
      items: sale.items,
      total: sale.total,
      date: sale.date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DOWNLOAD PDF ====================
exports.downloadSaleReceiptPDF = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    sale.printedCount = (sale.printedCount || 0) + 1;
    sale.lastPrintedAt = new Date();
    await sale.save();

    await generateSaleReceiptPDF(sale, res);
  } catch (error) {
    console.error('SALE PDF ERROR:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
};

// ==================== CANCEL SALE ====================
exports.cancelSale = async (req, res) => {
  try {
    const { reason, cancelledBy } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Reason required' });

    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const biz = await Business.findById(sale.businessId);

    // Reverse business balance
    if (biz) {
      biz.currentBalance = Math.max(0, (Number(biz.currentBalance) || 0) - Number(sale.total));
      await biz.save();
    }

    // Reverse journal
    try {
      await createJournalEntry({
        date: new Date(),
        description: `REVERSAL: Sale ${sale.receiptNumber} — ${reason}`,
        reference: sale._id.toString(),
        sourceType: 'business',
        lines: [
          { accountCode: '3010', debit: sale.total },
          { accountCode: biz?.fundAccountCode || '1100', credit: sale.total }
        ],
        createdBy: cancelledBy || 'admin'
      });
    } catch (e) { console.error('Reversal journal:', e.message); }

    // Restore stock
    for (const item of sale.items) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product && product.trackStock) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    sale.status = 'cancelled';
    sale.cancelledReason = reason;
    sale.cancelledAt = new Date();
    sale.cancelledBy = cancelledBy || 'admin';
    await sale.save();

    res.json({ success: true, message: 'Sale cancelled, stock restored', sale });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};