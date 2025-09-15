const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const User = require('../models/User'); // <-- ADD THIS LINE

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/loginadmin', authController.loginAdmin)
router.get('/user', auth, authController.getUser);
// Update current user profile
router.put('/user', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;