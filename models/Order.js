const { pool } = require("../config/database");

class Order {
  // Create new order
  static async create(orderData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        userId,
        items,
        totalAmount,
        shippingAddress,
        paymentMethod,
        cancelDeadline,
        note,
        couponCode = null,
        discountAmount = 0,
        pointsUsed = 0,
      } = orderData;

      // Create full address string
      const shippingAddressText = `${shippingAddress.address}, ${shippingAddress.ward}, ${shippingAddress.district}, ${shippingAddress.city}`;

      // Get current date for order_date
      const orderDate = new Date();

      // Generate unique order_number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const orderNumber = `ORD${timestamp}${random}`;

      // Insert order directly with shipping info
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          order_number, user_id, total_amount,
          customer_name, customer_phone, customer_email,
          shipping_address_text,
          payment_method, status, order_date, created_at,
          coupon_code, discount_amount, points_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          userId,
          totalAmount,
          shippingAddress.fullName,
          shippingAddress.phoneNumber,
          "", // customer_email
          shippingAddressText,
          paymentMethod,
          orderDate,
          orderDate,
          couponCode,
          discountAmount,
          pointsUsed,
        ],
      );

      const orderId = orderResult.insertId; // Get auto-increment ID

      // Insert order items
      for (const item of items) {
        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, product_image_url,
            quantity, unit_price, category_name, product_description, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId, // Use numeric ID, not order_number
            item.productId,
            item.productName,
            item.productImage,
            item.quantity,
            item.price,
            "", // category_name - can be added later
            "", // product_description - can be added later
            orderDate, // created_at
          ],
        );
      }

      await connection.commit();
      const newOrder = await this.findById(orderNumber);
      if (newOrder) {
          newOrder.numericId = orderId; // Use the direct insertId as fallback/source
      }
      return newOrder;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Find order by ID
  static async findById(orderId, connection = null) {
    const executor = connection || pool;
    const [orders] = await executor.query(
      `SELECT
        o.*,
        u.username, u.email, u.full_name as user_full_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?`,
      [orderId]
    );

    if (orders.length === 0) return null;

    const order = orders[0];

    // Get order items using orders.id (bigint), not order_number
    const [items] = await executor.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [order.id], // Use order.id (bigint) instead of orderId (order_number string)
    );

    return this.formatOrder(order, items);
  }

  // Find orders by user ID
  static async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*,
             (SELECT COUNT(*) FROM product_reviews pr WHERE pr.order_id = o.id) as reviews_count,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
      FROM orders o
      WHERE o.user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [orders] = await pool.query(query, params);

    // Get items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await pool.query(
          `SELECT * FROM order_items WHERE order_id = ?`,
          [order.id],
        );
        return this.formatOrder(order, items);
      }),
    );

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`;
    const countParams = [userId];
    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    const [countResult] = await pool.query(countQuery, countParams);

    return {
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        totalItems: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    };
  }

  // Update order status
  static async updateStatus(orderId, status, userId = null, carrierName = null, connection = null) {
    const updates = { status };
    const now = new Date();

    if (status === 'CONFIRMED') updates.confirmed_at = now;
    else if (status === 'CANCELLED') updates.cancelled_at = now;
    else if (status === 'DELIVERED') updates.delivered_at = now;
    if (carrierName) updates.carrier_name = carrierName;

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    
    let query = `UPDATE orders SET ${fields}, updated_at = NOW() WHERE order_number = ?`;
    const params = [...values, orderId];

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    const executor = connection || pool;
    const [result] = await executor.query(query, params);
    if (result.affectedRows === 0) return null;
    return await this.findById(orderId, connection);
  }

  // Cancel order
  static async cancel(orderId, userId, connection = null) {
    const order = await this.findById(orderId, connection);
    if (!order) return null;

    if (order.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const now = new Date();
    const cancelDeadline = order.cancelDeadline
      ? new Date(order.cancelDeadline)
      : new Date(new Date(order.order_date).getTime() + 30 * 60 * 1000);

    // 1. If status is NEW and within 30 mins -> Cancel immediately with refund
    if (order.status === 'NEW' && now <= cancelDeadline) {
      return await this.updateStatus(orderId, 'CANCELLED', userId, null, connection);
    }

    // 2. If status is NEW but already past 30 mins (should be CONFIRMED soon)
    if (order.status === 'NEW' && now > cancelDeadline) {
        throw new Error("Đơn hàng đang được hệ thống xác nhận, vui lòng đợi trong giây lát");
    }

    // 3. If status is CONFIRMED -> Block cancellation as per user request (Wait for PREPARING)
    if (order.status === 'CONFIRMED') {
        throw new Error("Đơn hàng đã được xác nhận. Bạn chỉ có thể gửi yêu cầu hủy khi Shop bắt đầu chuẩn bị hàng");
    }

    // 4. If status is PREPARING -> Allow cancellation request (Shop approval needed)
    if (order.status === 'PREPARING') {
        return await this.updateStatus(orderId, 'CANCEL_REQUESTED', userId, null, connection);
    }

    // Default: Not allowed to cancel in other statuses (SHIPPING, DELIVERED, etc.)
    throw new Error("Hành động không khả dụng ở trạng thái đơn hàng hiện tại");


    throw new Error("Cannot cancel order in current status");
  }

  // Find ALL orders (admin)
  static async findAll(options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = `SELECT o.*, u.username, u.email, u.full_name as user_full_name,
                         (SELECT COUNT(*) FROM product_reviews pr WHERE pr.order_id = o.id) as reviews_count,
                         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
      FROM orders o LEFT JOIN users u ON o.user_id = u.id`;
    const params = [];

    if (status) {
      query += ` WHERE o.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [orders] = await pool.query(query, params);
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const [items] = await pool.query(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
        return this.formatOrder(order, items);
      })
    );

    const countQuery = status
      ? `SELECT COUNT(*) as total FROM orders WHERE status = ?`
      : `SELECT COUNT(*) as total FROM orders`;
    const [countResult] = await pool.query(countQuery, status ? [status] : []);

    return {
      orders: ordersWithItems,
      pagination: { page, limit, totalItems: countResult[0].total, totalPages: Math.ceil(countResult[0].total / limit) },
    };
  }

  // Get order statistics
  static async getStats(userId = null) {
    let query = `
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'PREPARING' THEN 1 ELSE 0 END) as processing_orders,
        SUM(CASE WHEN status = 'SHIPPING' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN status = 'CANCEL_REQUESTED' THEN 1 ELSE 0 END) as cancel_requested_orders,
        SUM(total_amount) as total_revenue
      FROM orders
    `;

    const params = [];
    if (userId) {
      query += ` WHERE user_id = ?`;
      params.push(userId);
    }

    const [result] = await pool.query(query, params);
    return result[0];
  }

  // Helper: Format order object
  static formatOrder(order, items) {
    const canCancel =
      ["NEW", "CONFIRMED", "PREPARING"].includes(order.status) &&
      order.order_date &&
      new Date() - new Date(order.order_date) < 30 * 60 * 1000; // 30 minutes

    // Parse shipping_address_text to extract components
    const addressParts = order.shipping_address_text
      ? order.shipping_address_text.split(", ")
      : [];

    return {
      id: order.order_number,
      numericId: order.id,           // bigint PK, used by product_reviews.order_id
      userId: order.user_id,
      userEmail: order.email,
      userFullName: order.user_full_name,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name || "",
        productImage: item.product_image_url || item.product_image || "",
        price: parseFloat(item.unit_price || item.price || 0),
        quantity: item.quantity,
      })),
      totalAmount: parseFloat(order.total_amount),
      shippingFee: 0, // Default 0 as requested
      discountAmount: parseFloat(order.discount_amount || 0),
      pointsUsed: parseInt(order.points_used || 0),
      subtotal: parseFloat(order.total_amount) + parseFloat(order.discount_amount || 0) + parseInt(order.points_used || 0),
      shippingAddress: {
        fullName: order.customer_name || "",
        phoneNumber: order.customer_phone || "",
        address: addressParts[0] || "",
        ward: addressParts[1] || "",
        district: addressParts[2] || "",
        city: addressParts[3] || "",
        note: order.notes || "",
      },
      couponCode: order.coupon_code || null,
      paymentMethod: order.payment_method,
      carrierName: order.carrier_name || null,
      status: order.status,
      createdAt: order.created_at,
      confirmedAt: order.confirmed_at || null,
      cancelledAt: order.cancelled_at || null,
      deliveredAt: order.delivered_at || null,
      isReviewed: (order.reviews_count !== undefined && order.items_count !== undefined) 
        ? (order.reviews_count >= order.items_count && order.items_count > 0)
        : false,
      cancelDeadline: order.order_date
        ? new Date(new Date(order.order_date).getTime() + 30 * 60 * 1000)
        : null,
      canCancel: order.status === 'NEW' || order.status === 'PREPARING',
      isCancelRequested: order.status === 'CANCEL_REQUESTED'
    };
  }

  static async autoConfirmOrders() {
    try {
      // Auto confirm any NEW orders that are older than 30 minutes
      // Since order_date is datetime, we can use INTERVAL 30 MINUTE in MySQL
      const [result] = await pool.query(
        `UPDATE orders 
         SET status = 'CONFIRMED', updated_at = NOW() 
         WHERE status = 'NEW' AND order_date <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
      );
      return result.affectedRows;
    } catch (error) {
      console.error("Auto confirm error:", error);
      return 0;
    }
  }

  // Helper: Convert camelCase to snake_case
  static camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

module.exports = Order;
