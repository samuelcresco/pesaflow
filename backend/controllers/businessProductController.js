const Product = require('../models/Product');
const Business = require('../models/Business');

// ==================== CREATE PRODUCT ====================
exports.createProduct = async (req, res) => {
  try {
    const { businessId, name, description, sku, price, costPrice, category, stock, trackStock, lowStockThreshold, image } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (!price || Number(price) <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });

    const biz = await Business.findById(businessId);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const product = await Product.create({
      businessId,
      name: name.trim(),
      description: description || '',
      sku: sku || '',
      price: Number(price),
      costPrice: Number(costPrice) || 0,
      category: category || 'other',
      stock: Number(stock) || 0,
      trackStock: !!trackStock,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      image: image || ''
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('CREATE PRODUCT ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
};

// ==================== GET PRODUCTS BY BUSINESS ====================
exports.getProductsByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { active, category, search } = req.query;
    const filter = { businessId };
    if (active === 'true') filter.active = true;
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const products = await Product.find(filter).sort('name');
    res.json({ products, count: products.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== GET ONE ====================
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== UPDATE PRODUCT ====================
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const fields = ['name', 'description', 'sku', 'price', 'costPrice', 'category', 'stock', 'trackStock', 'lowStockThreshold', 'image', 'active'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    await product.save();
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== DELETE PRODUCT ====================
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== LOW STOCK WARNINGS ====================
exports.getLowStock = async (req, res) => {
  try {
    const { businessId } = req.params;
    const products = await Product.find({
      businessId,
      trackStock: true,
      active: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] }
    }).sort('stock');
    res.json({ products, count: products.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};