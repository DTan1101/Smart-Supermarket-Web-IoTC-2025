const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  resetSettings,
  getSettingsHistory
} = require('../controllers/settingsController');

// @route   GET /api/settings
// @desc    Get current supermarket settings
// @access  Public
router.get('/', getSettings);

// @route   POST /api/settings
// @desc    Update supermarket settings
// @access  Admin only
router.post('/', updateSettings);

// @route   POST /api/settings/reset
// @desc    Reset settings to default values
// @access  Admin only
router.post('/reset', resetSettings);

// @route   GET /api/settings/history
// @desc    Get settings update history
// @access  Admin only
router.get('/history', getSettingsHistory);

module.exports = router;