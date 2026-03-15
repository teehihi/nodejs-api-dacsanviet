const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const LoyaltyPoints = require('../models/LoyaltyPoints');
const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

// Create new order
exports.createOrder = async (req, res) => {
  let connection;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { items, shippingAddress, paymentMethod, note, couponCode, pointsToUse } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      });
    }

    // Calculate total amount
    let totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    let finalAmount = totalAmount;
    let discountAmount = 0;
    let couponId = null;
    let pointsUsedValue = 0;

    // Process Coupon
    if (couponCode) {
      const validation = await Coupon.validate(couponCode, userId, totalAmount);
      if (validation.isValid) {
        discountAmount += validation.discountAmount;
        couponId = validation.couponId;
      }
    }

    // Process Points
    if (pointsToUse && parseInt(pointsToUse) > 0) {
      const parsedPoints = parseInt(pointsToUse);
      const balance = await LoyaltyPoints.getBalance(userId);
      if (balance.current_balance < parsedPoints) {
        return res.status(400).json({ success: false, message: 'Không đủ điểm để sử dụng' });
      }
      pointsUsedValue = parsedPoints;
      discountAmount += parsedPoints; // 1 point = 1 VND
    }

    finalAmount = totalAmount - discountAmount;
    if (finalAmount < 0) finalAmount = 0;

    // Set cancel deadline (30 minutes from now)
    const cancelDeadline = new Date(Date.now() + 30 * 60 * 1000);

    const orderData = {
      userId,
      items,
      totalAmount: finalAmount,
      shippingAddress,
      paymentMethod: paymentMethod || "COD",
      cancelDeadline,
      note,
      couponCode,
      discountAmount,
      pointsUsed: pointsUsedValue
    };

    const order = await Order.create(orderData);

    // Apply coupon and points
    if (couponId || pointsUsedValue > 0) {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      if (couponId) {
        await Coupon.apply(connection, couponId, userId, order.id, discountAmount - pointsUsedValue);
      }
      if (pointsUsedValue > 0) {
        await LoyaltyPoints.usePoints(connection, userId, pointsUsedValue, order.id);
      }

      await connection.commit();
      connection.release();
    }

    res.status(201).json({
      success: true,
      message: "Đơn hàng đã được tạo thành công",
      data: { order },
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); connection.release(); } catch (e) { }
    }
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
  try {
    // Auto confirm orders older than 30 minutes
    await Order.autoConfirmOrders();

    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const result = await Order.findByUserId(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    res.json({
      success: true,
      message: "Orders retrieved successfully",
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve orders",
      error: error.message,
    });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    // Auto confirm orders older than 30 minutes
    await Order.autoConfirmOrders();

    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns the order (unless admin)
    if (order.userId !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      message: "Order retrieved successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order",
      error: error.message,
    });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.cancel(orderId, userId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng hoặc không thể hủy",
      });
    }

    res.json({
      success: true,
      message:
        order.status === "CANCEL_REQUESTED"
          ? "Đã gửi yêu cầu hủy đơn hàng"
          : "Hủy đơn hàng thành công",
      data: { order },
    });
  } catch (error) {
    console.error('Cancel order error:', error);

    if (error.message === 'Unauthorized') {
      return res.status(403).json({
        success: false,
        message: "Từ chối truy cập",
      });
    }

    if (error.message === "Cancel deadline has passed") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy đơn hàng sau 30 phút",
      });
    }

    if (error.message === "Cannot cancel order in current status") {
      return res.status(400).json({
        success: false,
        message: "Không thể hủy đơn hàng ở trạng thái hiện tại",
      });
    }

    res.status(500).json({
      success: false,
      message: "Hủy đơn hàng thất bại",
      error: error.message,
    });
  }
};

// Update order status (Admin only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, carrierName } = req.body;

    const validStatuses = [
      'NEW', 'CONFIRMED', 'PREPARING', 'SHIPPING',
      'DELIVERED', 'CANCELLED', 'CANCEL_REQUESTED',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false, message: 'Invalid status',
      });
    }

    // Reward points logic when delivered
    const oldOrder = await Order.findById(orderId);

    const order = await Order.updateStatus(orderId, status, null, carrierName);

    if (!order) {
      return res.status(404).json({
        success: false, message: 'Order not found',
      });
    }

    if (oldOrder && oldOrder.status !== 'DELIVERED' && status === 'DELIVERED') {
      try {
        const connection = await pool.getConnection();
        const pointsEarned = Math.floor(parseFloat(order.totalAmount) / 1000); // 1 point per 1000 VND
        await LoyaltyPoints.addPoints(connection, order.userId, pointsEarned, 'EARN_PURCHASE', 'Tặng điểm mua hàng', order.id);
        connection.release();
      } catch (err) {
        console.error('Failed to reward points:', err.message);
      }
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// Get ALL orders - Admin only
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const result = await Order.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });
    res.json({
      success: true,
      message: 'All orders retrieved successfully',
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message,
    });
  }
};

// Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const userId = req.user.role === "ADMIN" ? null : req.user.id;
    const stats = await Order.getStats(userId);

    res.json({
      success: true,
      message: "Order statistics retrieved successfully",
      data: { stats },
    });
  } catch (error) {
    console.error("Get order stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order statistics",
      error: error.message,
    });
  }
};
