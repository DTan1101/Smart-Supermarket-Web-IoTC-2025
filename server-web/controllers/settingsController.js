const Supermarket = require('../models/Supermarket');
const jwt = require('jsonwebtoken');

// Helper function to verify admin
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Chỉ admin mới có quyền truy cập' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

// @desc    Get supermarket settings
// @route   GET /api/settings
// @access  Public (for reading) / Admin (for writing)
const getSettings = async (req, res) => {
  try {
    const settings = await Supermarket.getDefaultSettings();
    
    // Remove sensitive fields for public access
    const publicSettings = {
      storeName: settings.storeName,
      address: settings.address,
      phone: settings.phone,
      pointsRate: settings.pointsRate,
      pointValue: settings.pointValue,
      invoiceTitle: settings.invoiceTitle,
      invoiceNote: settings.invoiceNote,
      updatedAt: settings.updatedAt
    };

    res.json(publicSettings);
  } catch (error) {
    console.error('Lỗi lấy settings:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy cài đặt',
      error: error.message 
    });
  }
};

// @desc    Update supermarket settings
// @route   POST /api/settings
// @access  Admin only
const updateSettings = [
  verifyAdmin,
  async (req, res) => {
    try {
      const {
        storeName,
        address,
        phone,
        pointsRate,
        pointValue,
        invoiceTitle,
        invoiceNote
      } = req.body;

      // Validate numeric fields
      if (pointsRate && (typeof pointsRate !== 'number' || pointsRate < 1000)) {
        return res.status(400).json({ 
          message: 'Tỷ lệ tích điểm phải là số và ít nhất 1000 VNĐ/điểm' 
        });
      }

      if (pointValue && (typeof pointValue !== 'number' || pointValue < 100)) {
        return res.status(400).json({ 
          message: 'Giá trị điểm phải là số và ít nhất 100 VNĐ/điểm' 
        });
      }

      // Get existing settings or create default
      const settings = await Supermarket.getDefaultSettings();

      // Update settings
      const updatedSettings = await settings.updateSettings({
        storeName,
        address,
        phone,
        pointsRate: Number(pointsRate),
        pointValue: Number(pointValue),
        invoiceTitle,
        invoiceNote
      }, req.user.id);

      // Return public settings
      const publicSettings = {
        storeName: updatedSettings.storeName,
        address: updatedSettings.address,
        phone: updatedSettings.phone,
        pointsRate: updatedSettings.pointsRate,
        pointValue: updatedSettings.pointValue,
        invoiceTitle: updatedSettings.invoiceTitle,
        invoiceNote: updatedSettings.invoiceNote,
        updatedAt: updatedSettings.updatedAt
      };

      res.json({
        message: 'Cập nhật cài đặt thành công',
        ...publicSettings
      });

    } catch (error) {
      console.error('Lỗi cập nhật settings:', error);
      res.status(500).json({ 
        message: 'Lỗi server khi cập nhật cài đặt',
        error: error.message 
      });
    }
  }
];

// @desc    Reset settings to default
// @route   POST /api/settings/reset
// @access  Admin only
const resetSettings = [
  verifyAdmin,
  async (req, res) => {
    try {
      // Find current settings and delete
      const currentSettings = await Supermarket.findOne({ isActive: true });
      if (currentSettings) {
        await currentSettings.deleteOne();
      }

      // Create new default settings
      const defaultSettings = await Supermarket.getDefaultSettings();

      const publicSettings = {
        storeName: defaultSettings.storeName,
        address: defaultSettings.address,
        phone: defaultSettings.phone,
        pointsRate: defaultSettings.pointsRate,
        pointValue: defaultSettings.pointValue,
        invoiceTitle: defaultSettings.invoiceTitle,
        invoiceNote: defaultSettings.invoiceNote,
        updatedAt: defaultSettings.updatedAt
      };

      res.json({
        message: 'Đã khôi phục cài đặt về mặc định',
        ...publicSettings
      });

    } catch (error) {
      console.error('Lỗi reset settings:', error);
      res.status(500).json({ 
        message: 'Lỗi server khi khôi phục cài đặt',
        error: error.message 
      });
    }
  }
];

// @desc    Get settings history (for admin)
// @route   GET /api/settings/history
// @access  Admin only
const getSettingsHistory = [
  verifyAdmin,
  async (req, res) => {
    try {
      const settings = await Supermarket.find()
        .populate('lastUpdatedBy', 'fullName username')
        .sort({ updatedAt: -1 })
        .limit(10);

      res.json(settings);
    } catch (error) {
      console.error('Lỗi lấy lịch sử settings:', error);
      res.status(500).json({ 
        message: 'Lỗi server khi lấy lịch sử cài đặt',
        error: error.message 
      });
    }
  }
];

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  getSettingsHistory
};