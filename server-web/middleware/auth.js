// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const auth = async (req, res, next) => {
//   try {
//     // Lấy token từ header
//     const token = req.header('Authorization').replace('Bearer ', '');
//     // Giải mã token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     // Tìm user dựa trên ID trong token
//     const user = await User.findOne({ _id: decoded.id });

//     if (!user) {
//       throw new Error();
//     }

//     // Gán user và token vào request
//     req.user = user;
//     req.token = token;
//     next(); // Chuyển đến controller
//   } catch (e) {
//     res.status(401).send({ error: 'Vui lòng xác thực.' });
//   }
// };

// module.exports = auth;

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Không có token xác thực' 
      });
    }

    // Extract token from header
    const token = authHeader.replace('Bearer ', '');
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        error: 'Token không hợp lệ' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      return res.status(401).json({ 
        error: 'Token không hợp lệ hoặc đã hết hạn' 
      });
    }

    // Find user by ID
    const user = await User.findOne({ _id: decoded.id }).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Người dùng không tồn tại' 
      });
    }

    // Add user info to request object
    req.user = {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.isAdmin,
      points: user.points
    };
    req.token = token;
    
    next(); // Continue to next middleware/controller
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      error: 'Lỗi xác thực, vui lòng đăng nhập lại' 
    });
  }
};

module.exports = auth;