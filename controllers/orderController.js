const Order = require("../models/Order");
const { validationResult } = require("express-validator");

// Create new order
exports.createOrder = async (req, res) => {
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
    const { items, shippingAddress, paymentMethod } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      });
    }

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Generate order ID
    const orderId = `ORD${Date.now()}`;

    // Set cancel deadline (30 minutes from now)
    const cancelDeadline = new Date(Date.now() + 30 * 60 * 1000);

    const orderData = {
      id: orderId,
      userId,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod: paymentMethod || "COD",
      cancelDeadline,
    };

    const order = await Order.create(orderData);

    res.status(201).json({
      success: true,
      message: "Đơn hàng đã được tạo thành công",
      data: { order },
    });
  } catch (error) {
    console.error("Create order error:", error);
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
    console.error("Cancel order error:", error);

    if (error.message === "Unauthorized") {
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
    const { status } = req.body;

    const validStatuses = [
      'NEW',
      'CONFIRMED',
      'PREPARING',
      'SHIPPING',
      'DELIVERED',
      'CANCELLED',
      'CANCEL_REQUESTED',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const order = await Order.updateStatus(orderId, status);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
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
