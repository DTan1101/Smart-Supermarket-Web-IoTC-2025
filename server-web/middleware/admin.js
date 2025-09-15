// const admin = (req, res, next) => {
//   // Kiểm tra nếu người dùng đã đăng nhập và có quyền admin
//   if (req.user && req.user.isAdmin) {
//     next(); // Cho phép tiếp tục
//   } else {
//     res.status(403).json({ message: 'Không có quyền truy cập' });
//   }
// };

// module.exports = admin;

const admin = (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Vui lòng đăng nhập trước' 
      });
    }

    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        message: 'Không có quyền truy cập. Chỉ admin mới có thể thực hiện thao tác này.' 
      });
    }

    // Log admin action for security
    console.log(`Admin action by user: ${req.user.username} (${req.user.id})`);
    
    next(); // Allow to continue
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ 
      message: 'Lỗi hệ thống khi kiểm tra quyền admin' 
    });
  }
};

module.exports = admin;