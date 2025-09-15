const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // Đổi tên để tránh xung đột
const adminMiddleware = require('../middleware/admin');
const orderController = require('../controllers/orderController'); // Import controller

// Sử dụng tên rõ ràng cho controller functions
router.post('/', authMiddleware, orderController.createOrder);
router.get('/myorders', authMiddleware, orderController.getMyOrders);
router.get('/', authMiddleware, adminMiddleware, orderController.getAllOrders);
router.put('/:id', authMiddleware, adminMiddleware, orderController.updateOrderStatus);

module.exports = router;