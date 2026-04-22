const Order = require('../../models/Order');
const Notification = require('../../models/Notification'); // Nếu cần gửi thông báo
// Hàm notifyUser có thể được tách ra một util dùng chung hoặc lấy từ đâu đó, tạm thời lấy từ Notification websocket (nếu có)
// Tuy nhiên ở đây chỉ demo logic cập nhật

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
      data: {
        orders: result.orders,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('Admin get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message,
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, carrierName, shippingFee, cancelReason, paymentMethod } = req.body;

    const validStatuses = [
      'NEW', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'CANCEL_REQUESTED', 'RETURNED'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    // Require carrier check if SHIPPING
    if (status === 'SHIPPING' && !carrierName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp thông tin Đơn vị Vận Chuyển',
      });
    }
    
    // Require cancel reason if CANCELLED
    if (status === 'CANCELLED' && !cancelReason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do hủy đơn hàng',
      });
    }

    const order = await Order.updateStatus(orderId, status, null, carrierName, cancelReason, paymentMethod, shippingFee);


    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    });
  }
};
