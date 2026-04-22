const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const LoyaltyPoints = require('../models/LoyaltyPoints');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { notifyUser, notifyAdmin } = require('../socket/socketManager');
const { pool } = require('../config/database');
const { validationResult } = require('express-validator');
const { notifyAdminsPush } = require('../config/firebaseAdmin');

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
        await Coupon.apply(connection, couponId, userId, parseInt(order.numericId), discountAmount - pointsUsedValue);
      }
      if (pointsUsedValue > 0) {
        await LoyaltyPoints.usePoints(connection, userId, pointsUsedValue, parseInt(order.numericId));
      }

      await connection.commit();
      connection.release();
    }

    res.status(201).json({
      success: true,
      message: "Đơn hàng đã được tạo thành công",
      data: { order },
    });

    // Notify user + admin after response
    try {
      // 1. Thông báo cho User (Lưu DB + Socket)
      const orderCode = order.order_number || order.code || order.id;
      const userNotifBody = `Đơn hàng ${orderCode} của bạn đã được đặt thành công. Chúng tôi sẽ xác nhận sớm nhất có thể.`;
      const userNotif = await Notification.create({
        userId,
        type: 'ORDER_NEW',
        title: 'Đặt hàng thành công',
        body: userNotifBody,
        data: { orderId: order.id },
      });
      notifyUser(userId, 'notification', userNotif);

      // 2. Thông báo cho Admin (chỉ khi người đặt KHÔNG phải admin)
      if (req.user.role !== 'ADMIN') {
        const userName = req.user.fullName || req.user.username || 'Khách hàng';
        const adminNotifBody = `Có đơn hàng mới ${orderCode} từ khách hàng ${userName}. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')}đ`;
        const adminNotif = await Notification.create({
          userId: null, // broadcast to admin
          type: 'ORDER_NEW',
          title: 'Đơn hàng mới',
          body: adminNotifBody,
          data: { orderId: order.id, userName, totalAmount: finalAmount },
        });

        // Gửi cả 2 sự kiện socket để tương thích với các màn hình admin cũ/mới
        notifyAdmin('new_order', { orderId: order.id, userId, totalAmount: finalAmount, userName });
        notifyAdmin('notification', adminNotif);

        // 3. Thông báo đẩy FCM (Background/Terminated)
        notifyAdminsPush({
          title: '🛍️ Đơn hàng mới!',
          body: `Khách hàng ${userName} vừa đặt đơn hàng ${orderCode} giá trị ${finalAmount.toLocaleString('vi-VN')}đ`,
        }, {
          orderId: order.id,
          type: 'NEW_ORDER'
        });
      }
    } catch (e) {
      console.error('Notify error:', e.message);
    }
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
    await Order.autoConfirmOrders();

    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Attach review status for DELIVERED orders
    let reviewStatus = null;
    if (order.status === 'DELIVERED' && order.numericId) {
      reviewStatus = await Review.getOrderReviewStatus(userId, order.numericId);
    }

    res.json({
      success: true,
      message: 'Order retrieved successfully',
      data: { order, reviewStatus },
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve order', error: error.message });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  let connection;
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Get order details first to check status and rewards
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (order.userId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Check if directly cancellable (NEW or CONFIRMED)
    const isDirectlyCancellable = ["NEW", "CONFIRMED"].includes(order.status);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Perform the cancellation status update within the transaction
    const updatedOrder = await Order.cancel(orderId, userId, connection);

    // If it's now CANCELLED and it wasn't shipped yet, refund rewards
    // This handles the < 30mins immediate cancel case
    if (updatedOrder && updatedOrder.status === "CANCELLED") {
      const preShippingStatuses = ["NEW", "CONFIRMED", "PREPARING"];
      if (preShippingStatuses.includes(order.status)) {
        console.log(`Auto-refunding rewards for user cancel: ${orderId}`);

        if (order.couponCode) {
          const [couponRows] = await connection.query('SELECT id FROM coupons WHERE code = ?', [order.couponCode]);
          if (couponRows.length > 0) {
            await Coupon.refund(connection, couponRows[0].id, userId, order.numericId);
          }
        }

        if (order.pointsUsed > 0) {
          await LoyaltyPoints.refundPoints(connection, userId, order.pointsUsed, order.numericId);
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: updatedOrder.status === "CANCEL_REQUESTED"
        ? "Đã gửi yêu cầu hủy đơn hàng"
        : "Hủy đơn hàng thành công",
      data: { order: updatedOrder },
    });

    // Notify user + admin about cancellation
    try {
      const isRequest = updatedOrder.status === "CANCEL_REQUESTED";
      const title = isRequest ? 'Yêu cầu hủy đơn hàng' : 'Đơn hàng đã hủy';
      const body = `Đơn hàng ${updatedOrder.order_number || updatedOrder.code || updatedOrder.id} ${isRequest ? 'đang chờ xác nhận hủy' : 'đã được hủy thành công'}.`;
      
      const notif = await Notification.create({
        userId,
        type: isRequest ? 'ORDER_CANCEL_REQUESTED' : 'ORDER_CANCELLED',
        title,
        body,
        data: { orderId: updatedOrder.id },
      });
      notifyUser(userId, 'notification', notif);

      // Notify admin
      const adminBody = `Khách hàng ${req.user.fullName || req.user.username} ${isRequest ? 'yêu cầu hủy' : 'đã hủy'} đơn hàng ${updatedOrder.order_number || updatedOrder.code || updatedOrder.id}.`;
      const adminNotif = await Notification.create({
        userId: null,
        type: isRequest ? 'ORDER_CANCEL_REQUESTED' : 'ORDER_CANCELLED',
        title: isRequest ? 'Yêu cầu hủy đơn' : 'Đơn hàng bị hủy',
        body: adminBody,
        data: { orderId: updatedOrder.id },
      });
      notifyAdmin('notification', adminNotif);
    } catch (e) {
      console.error('Notify cancel error:', e.message);
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Cancel order error:', error);

    if (error.message === 'Unauthorized') {
      return res.status(403).json({ success: false, message: "Từ chối truy cập" });
    }

    if (error.message === "Cancel deadline has passed") {
      return res.status(400).json({ success: false, message: "Không thể hủy đơn hàng sau 30 phút" });
    }

    if (error.message === "Cannot cancel order in current status") {
      return res.status(400).json({ success: false, message: "Không thể hủy đơn hàng ở trạng thái hiện tại" });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Hủy đơn hàng thất bại",
    });
  } finally {
    if (connection) connection.release();
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
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const oldOrder = await Order.findById(orderId);
    const order = await Order.updateStatus(orderId, status, null, carrierName);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // When transitioning to DELIVERED:
    if (oldOrder && oldOrder.status !== 'DELIVERED' && status === 'DELIVERED') {
      let connection;
      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Stamp delivered_at on the order row
        await connection.query(
          `UPDATE orders SET delivered_at = NOW() WHERE order_number = ?`,
          [orderId]
        );

        // 2. Award purchase points (1 pt per 1 000 VND)
        const pointsEarned = Math.floor(parseFloat(order.totalAmount) / 1000);
        if (pointsEarned > 0) {
          await LoyaltyPoints.addPoints(
            connection, order.userId, pointsEarned,
            'EARN_PURCHASE', 'Tặng điểm mua hàng', order.numericId
          );
        }

        await connection.commit();
      } catch (err) {
        if (connection) await connection.rollback();
        console.error('Failed to stamp delivered_at / reward points:', err.message);
      } finally {
        if (connection) connection.release();
      }
    }

    // When transitioning to CANCELLED (Refund rewards):
    if (oldOrder && oldOrder.status !== 'CANCELLED' && status === 'CANCELLED') {
      // Only refund if the order WAS NOT shipped/delivered
      const preShippingStatuses = ["NEW", "CONFIRMED", "PREPARING", "CANCEL_REQUESTED"];

      if (preShippingStatuses.includes(oldOrder.status)) {
        let connection;
        try {
          connection = await pool.getConnection();
          await connection.beginTransaction();

          console.log(`Auto-refunding rewards for Admin cancel: ${orderId}`);

          // Refund Coupon
          if (oldOrder.couponCode) {
            const [couponRows] = await connection.query('SELECT id FROM coupons WHERE code = ?', [oldOrder.couponCode]);
            if (couponRows.length > 0) {
              await Coupon.refund(connection, couponRows[0].id, oldOrder.userId, oldOrder.numericId);
            }
          }

          // Refund Points
          if (oldOrder.pointsUsed > 0) {
            await LoyaltyPoints.refundPoints(connection, oldOrder.userId, oldOrder.pointsUsed, oldOrder.numericId);
          }

          await connection.commit();
        } catch (err) {
          if (connection) await connection.rollback();
          console.error('Failed to auto-refund on admin cancel:', err.message);
        } finally {
          if (connection) connection.release();
        }
      } else {
        console.log(`Order ${orderId} was already in ${oldOrder.status} status. No reward refund.`);
      }
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order },
    });

    // Notify user about status change
    try {
      const labels = {
        NEW: 'Đơn hàng mới tạo',
        CONFIRMED: 'Đơn hàng đã được xác nhận',
        PREPARING: 'Đang chuẩn bị hàng',
        SHIPPING: 'Đơn hàng đang được giao',
        DELIVERED: 'Đơn hàng đã giao thành công',
        CANCELLED: 'Đơn hàng đã bị hủy',
        CANCEL_REQUESTED: 'Yêu cầu hủy đơn hàng',
        RETURNED: 'Đơn hàng đã được hoàn trả',
      };
      const label = labels[status];
      if (label && order.userId) {
        // Special logic for DELIVERED: Award loyalty points
        if (status === 'DELIVERED' && oldOrder.status !== 'DELIVERED') {
          try {
            const rewardPoints = Math.floor(order.totalAmount * 0.01); // 1% reward points
            if (rewardPoints > 0) {
              const pointConn = await pool.getConnection();
              await pointConn.beginTransaction();
              try {
                await LoyaltyPoints.addPoints(
                  pointConn, 
                  order.userId, 
                  rewardPoints, 
                  'ORDER_DELIVERED', 
                  `Điểm thưởng cho đơn hàng ${order.order_number || order.id}`,
                  order.id
                );
                await pointConn.commit();
                console.log(`✅ Awarded ${rewardPoints} points to user ${order.userId} for order ${order.id}`);
              } catch (err) {
                await pointConn.rollback();
                console.error('Failed to award points:', err.message);
              } finally {
                pointConn.release();
              }
            }
          } catch (e) { console.error('Points awarding error:', e.message); }
        }

        const notif = await Notification.create({
          userId: order.userId,
          type: `ORDER_${status}`,
          title: label,
          body: `Đơn hàng ${order.order_number || order.code || order.id} - ${label.toLowerCase()}.`,
          data: { orderId: order.id, status },
        });
        notifyUser(order.userId, 'notification', notif);
      }
    } catch (e) { console.error('Notify error:', e.message); }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    });
  }
};

// Get ALL orders - Admin only
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;
    const result = await Order.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      userId
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
