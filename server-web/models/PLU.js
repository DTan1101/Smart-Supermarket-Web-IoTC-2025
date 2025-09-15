const mongoose = require('mongoose');

const pluSchema = new mongoose.Schema({
  pluCode: { type: String, required: true, unique: true }, // Đổi tên thành pluCode
  name: { type: String, required: true },
  pricePerKg: { type: Number, required: true }, // Đổi tên thành pricePerKg
  category: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('plus', pluSchema);