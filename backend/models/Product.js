const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },

  name: { type: String, required: true },
  description: { type: String, default: '' },
  sku: { type: String, default: '' },                  // optional stock-keeping unit

  price: { type: Number, required: true, min: 0 },     // selling price
  costPrice: { type: Number, default: 0, min: 0 },     // optional cost for margin calc

  category: {
    type: String,
    enum: ['apparel', 'accessories', 'food', 'poultry', 'services', 'other'],
    default: 'other'
  },

  // Stock tracking
  stock: { type: Number, default: 0 },                 // current quantity on hand
  trackStock: { type: Boolean, default: false },       // if true, sales reduce stock
  lowStockThreshold: { type: Number, default: 5 },     // warn when stock <= threshold

  image: { type: String, default: '' },                // base64 or path
  active: { type: Boolean, default: true }
}, { timestamps: true });

ProductSchema.virtual('marginAmount').get(function() {
  return (Number(this.price) || 0) - (Number(this.costPrice) || 0);
});

ProductSchema.virtual('marginPercent').get(function() {
  const price = Number(this.price) || 0;
  if (price === 0) return 0;
  return Math.round(((price - (Number(this.costPrice) || 0)) / price) * 10000) / 100;
});

ProductSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', ProductSchema);