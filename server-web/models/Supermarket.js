const mongoose = require('mongoose');

const SupermarketSchema = new mongoose.Schema({
  // Store Information
  storeName: {
    type: String,
    default: 'Siêu Thị Mini'
  },
  address: {
    type: String,
    default: '123 Đường Nguyễn Huệ, Quận 1, TP.HCM'
  },
  phone: {
    type: String,
    default: '(028) 1234 5678'
  },

  // Points Configuration
  pointsRate: {
    type: Number,
    default: 10000, // VNĐ per point
    min: 1000
  },
  pointValue: {
    type: Number,
    default: 1000, // VNĐ value per point
    min: 100
  },

  // Invoice Settings
  invoiceTitle: {
    type: String,
    default: 'Siêu Thị Mini - Hóa Đơn Mua Hàng'
  },
  invoiceNote: {
    type: String,
    default: 'Cảm ơn quý khách đã mua sắm tại siêu thị chúng tôi!'
  },

  // System Configuration
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware to update the updatedAt field
SupermarketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get or create default settings
SupermarketSchema.statics.getDefaultSettings = async function() {
  let settings = await this.findOne({ isActive: true });
  
  if (!settings) {
    settings = new this({});
    await settings.save();
  }
  
  return settings;
};

// Method to update settings
SupermarketSchema.methods.updateSettings = function(newSettings, userId) {
  Object.keys(newSettings).forEach(key => {
    if (this.schema.paths[key] && key !== '_id' && key !== '__v') {
      this[key] = newSettings[key];
    }
  });
  
  this.lastUpdatedBy = userId;
  this.updatedAt = Date.now();
  
  return this.save();
};

module.exports = mongoose.model('Supermarket', SupermarketSchema);