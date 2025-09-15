const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Middleware kiểm tra quyền admin
const adminAuth = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Truy cập bị từ chối. Yêu cầu quyền admin.' });
  }
  next();
};

// Lấy danh sách admin
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true }).select('-password');
    res.json(admins);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi server');
  }
});

// Đăng ký admin mới (route /api/admin/register)
router.post('/register', auth, adminAuth, async (req, res) => {
  try {
    const { username, fullName, email, phone, password, bankName, bankAccount, bankHolder, momoPhone, momoHolder } = req.body;

    // Kiểm tra xem username hoặc email đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username hoặc email đã tồn tại' });
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new User({
      username,
      password: hashedPassword,
      fullName,
      email,
      phone,
      isAdmin: true,
      bankName,
      bankAccount,
      bankHolder,
      momoPhone,
      momoHolder
    });

    await newAdmin.save();
    res.status(201).json({ message: 'Đăng ký admin thành công', admin: newAdmin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Đăng ký admin thất bại');
  }
});

// Lấy thông tin chi tiết của admin
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.params.id).select('-password');
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: 'Không tìm thấy admin' });
    }
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi server');
  }
});

// Cập nhật thông tin admin
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { username, fullName, email, phone, password, bankName, bankAccount, bankHolder, momoPhone, momoHolder } = req.body;

    const admin = await User.findById(req.params.id);
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: 'Không tìm thấy admin' });
    }

    // Kiểm tra xem username hoặc email đã tồn tại chưa (nếu thay đổi)
    if (username && username !== admin.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username đã tồn tại' });
      }
    }
    if (email && email !== admin.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email đã tồn tại' });
      }
    }

    // Cập nhật thông tin
    admin.username = username || admin.username;
    admin.fullName = fullName || admin.fullName;
    admin.email = email || admin.email;
    admin.phone = phone || admin.phone;
    admin.bankName = bankName || admin.bankName;
    admin.bankAccount = bankAccount || admin.bankAccount;
    admin.bankHolder = bankHolder || admin.bankHolder;
    admin.momoPhone = momoPhone || admin.momoPhone;
    admin.momoHolder = momoHolder || admin.momoHolder;

    // Nếu có mật khẩu mới, mã hóa và cập nhật
    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    await admin.save();
    res.json({ message: 'Cập nhật admin thành công', admin: admin });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cập nhật admin thất bại');
  }
});

// Xóa admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    // Không cho phép xóa admin hiện tại
    if (req.params.id === req.user.id) {
      return res.status(403).json({ message: 'Không thể xóa chính mình' });
    }

    const admin = await User.findById(req.params.id);
    if (!admin || !admin.isAdmin) {
      return res.status(404).json({ message: 'Không tìm thấy admin' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa admin thành công' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Xóa admin thất bại');
  }
});

// Lấy thông tin tài khoản admin hiện tại
router.get('/account', auth, adminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id)
      .select('bankName bankAccount bankHolder momoPhone momoHolder');
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi server');
  }
});

// Cập nhật thông tin tài khoản admin hiện tại
router.put('/account', auth, adminAuth, async (req, res) => {
  try {
    const { bankName, bankAccount, bankHolder, momoPhone, momoHolder } = req.body;

    const updatedAdmin = await User.findByIdAndUpdate(
      req.user.id,
      { bankName, bankAccount, bankHolder, momoPhone, momoHolder },
      { new: true, runValidators: true }
    ).select('bankName bankAccount bankHolder momoPhone momoHolder');

    res.json(updatedAdmin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cập nhật thất bại');
  }
});

router.post('/verify-password', auth, adminAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Mật khẩu không đúng' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Lỗi server');
  }
});

module.exports = router;