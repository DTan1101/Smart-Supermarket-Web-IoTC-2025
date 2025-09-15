// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   fullName: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   phone: { type: String },
//   points: { type: Number, default: 0 },
//   isAdmin: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Users', userSchema);
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true // ĐÂY ĐÃ TẠO INDEX - KHÔNG CẦN TẠO THỦ CÔNG
  },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true // ĐÂY ĐÃ TẠO INDEX - KHÔNG CẦN TẠO THỦ CÔNG
  },
  phone: { type: String },
  points: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  bankName: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  bankHolder: { type: String, default: '' },
  momoPhone: { type: String, default: '' },
  momoHolder: { type: String, default: '' },
});

// XÓA HOÀN TOÀN CÁC DÒNG TẠO INDEX THỦ CÔNG DƯỚI ĐÂY NẾU CÓ
// KHÔNG ĐƯỢC SỬ DỤNG userSchema.index() CHO CÁC TRƯỜNG ĐÃ CÓ unique: true

module.exports = mongoose.model('users', userSchema);