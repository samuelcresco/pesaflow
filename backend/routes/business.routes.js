const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const productController = require('../controllers/businessProductController');
const saleController = require('../controllers/businessSaleController');
const poolController = require('../controllers/profitPoolController');
const brandingController = require('../controllers/businessBrandingController');

// ==================== PROFILE POOL (must come before /:id) ====================
router.get('/profit-pool/status', poolController.getPoolStatus);
router.get('/profit-pool/history', poolController.getPoolHistory);
router.get('/profit-pool/ratio', poolController.getProfitVsCapitalRatio);
router.get('/profit-pool/multi-year', poolController.getMultiYearProfit);
router.post('/profit-pool/declare', poolController.declareProfit);
router.post('/profit-pool/extract', poolController.extractFromPool);
router.post('/profit-pool/declaration/:id/reverse', poolController.reverseDeclaration);

// ==================== SALES (before /:id) ====================
router.get('/sales/verify/:number', saleController.verifySale);
router.get('/sales/:id', saleController.getSaleById);
router.get('/sales/:id/pdf', saleController.downloadSaleReceiptPDF);
router.post('/sales/:id/cancel', saleController.cancelSale);
router.get('/:businessId/sales', saleController.getSalesByBusiness);
router.post('/sales/create', saleController.createSale);

// ==================== PRODUCTS ====================
router.get('/:businessId/products/low-stock', productController.getLowStock);
router.get('/:businessId/products', productController.getProductsByBusiness);
router.post('/products/create', productController.createProduct);
router.get('/products/:id', productController.getProductById);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// ==================== BRANDING ====================
router.get('/:id/branding', brandingController.getBranding);
router.put('/:id/branding', brandingController.updateBranding);

// ==================== BUSINESSES (existing) ====================
router.post('/', businessController.createBusiness);
router.get('/', businessController.getAllBusinesses);
router.get('/transactions', businessController.getTransactions);
router.get('/:id', businessController.getBusinessById);
router.delete('/:id', businessController.deleteBusiness);

// Capital & transactions
router.post('/allocate-capital', businessController.allocateCapital);
router.post('/record-transaction', businessController.recordTransaction);
router.post('/extract-profit', businessController.extractProfit);

module.exports = router;