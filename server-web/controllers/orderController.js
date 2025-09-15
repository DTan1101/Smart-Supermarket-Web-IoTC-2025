// controllers/orderController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const PLU = require('../models/PLU'); // optional, nếu bạn có model PLU

// Tạo order
exports.createOrder = async (req, res) => {
  try {
    const { cart, totalAmount, paymentMethod, status } = req.body;
    const userId = req.user && req.user.id ? req.user.id : null;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    const items = (cart || []).map(item => {
      const isObjectId = mongoose.Types.ObjectId.isValid(item._id);
      return {
        product: isObjectId ? item._id : null,
        rawId: item._id ? String(item._id) : null,
        pluCode: item.pluCode || null,
        name: item.name || item.pluName || 'Unknown item',
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        price: typeof item.price === 'number' ? item.price : Number(item.totalPrice || 0),
        isWeighted: !!item.isWeighted,
        weightGrams: item.weightGrams || null
      };
    });

    const orderObj = {
      user: userId,
      items,
      total: Number(totalAmount) || items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0),
      paymentMethod: paymentMethod || 'unknown',
      status: status || 'pending',
      isGuest: !!(req.user && req.user.isGuest)
    };

    const order = new Order(orderObj);
    const createdOrder = await order.save();

    // Cập nhật stock cho items có product thực sự
    await Promise.all((cart || []).map(async (item) => {
      try {
        if (mongoose.Types.ObjectId.isValid(item._id)) {
          const product = await Product.findById(item._id);
          if (product) {
            const qty = Number(item.quantity || 1);
            product.countInStock = Math.max(0, (product.countInStock || 0) - qty);
            await product.save();
          }
        } else {
          // non-product (PLU) — nếu muốn quản lý tồn tại, cập nhật model PLU tại đây khi bạn thêm field `stock`
          if (item.pluCode) {
            const plu = await PLU.findOne({ pluCode: String(item.pluCode) });
            if (plu) {
              // ví dụ: if (plu.stock) { plu.stock = Math.max(0, plu.stock - (item.quantity || 1)); await plu.save(); }
            }
          }
        }
      } catch (err) {
        console.warn('Error updating stock for item', item._id, err && err.message ? err.message : err);
      }
    }));

    // Update user points (nếu không phải guest)
    if (userId && !(req.user && req.user.isGuest)) {
      try {
        const pointsEarned = Math.floor((Number(orderObj.total) || 0) / 10000);
        const user = await User.findById(userId);
        if (user) {
          user.points = (user.points || 0) + pointsEarned;
          await user.save();
          createdOrder.pointsEarned = pointsEarned;
          await createdOrder.save();
        }
      } catch (ptsErr) {
        console.warn('Failed to update points:', ptsErr && ptsErr.message ? ptsErr.message : ptsErr);
      }
    }

    return res.status(201).json(createdOrder);
  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Lấy orders của user hiện tại
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const orders = await Order.find({ user: userId });
    return res.json(orders);
  } catch (error) {
    console.error('getMyOrders error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Lấy tất cả (admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'fullName email');
    return res.json(orders);
  } catch (error) {
    console.error('getAllOrders error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Cập nhật trạng thái đơn hàng (admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    order.status = status;
    const updated = await order.save();
    return res.json(updated);
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};
