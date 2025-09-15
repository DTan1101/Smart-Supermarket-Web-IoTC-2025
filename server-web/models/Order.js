// models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.Mixed, ref: 'products', required: false },
  rawId: { type: String, required: false }, // id gốc (barcode hoặc PLU string)
  pluCode: { type: String, required: false },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true },
  isWeighted: { type: Boolean, default: false },
  weightGrams: { type: Number, required: false }
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: false },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: { 
    type: String, 
    required: true,
    default: 'pending',
    enum: ['pending', 'paid', 'processing', 'completed', 'cancelled']
  },
  pointsEarned: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isGuest: { type: Boolean, default: false }
});

module.exports = mongoose.model('orders', orderSchema);
