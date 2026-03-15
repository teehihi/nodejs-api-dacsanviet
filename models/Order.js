const { pool } = require("../config/database");

class Order {
  // Create new order
  static async create(orderData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        id,
        userId,
        items,
        totalAmount,
        shippingAddress,
        paymentMethod,
        cancelDeadline,
      } = orderData;

      // Create full address string
      const shippingAddressText = `${shippingAddress.address}, ${shippingAddress.ward}, ${shippingAddress.district}, ${shippingAddress.city}`;

      // Get current date for order_date
      const orderDate = new Date();

      // Insert order directly with shipping info
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          order_number, user_id, total_amount,
          customer_name, customer_phone, customer_email,
          shipping_address_text,
          payment_method, status, order_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)`,
        [
          id,
          userId,
          totalAmount,
          shippingAddress.fullName,
          shippingAddress.phoneNumber,
          "", // customer_email - can get from user table if needed
          shippingAddressText,
          paymentMethod,
          orderDate,
          orderDate,
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
      return await this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Find order by ID
  static async findById(orderId) {
    const [orders] = await pool.query(
      `SELECT
        o.*,
        u.username, u.email, u.full_name as user_full_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?`,
      [orderId],
    );

    if (orders.length === 0) return null;

    const order = orders[0];

    // Get order items using orders.id (bigint), not order_number
    const [items] = await pool.query(
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
      SELECT o.*
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
  static async updateStatus(orderId, status, userId = null) {
    const updates = { status, updated_at: new Date() };

    // Format SET clause securely
    const fields = ['status', 'updated_at']
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [updates.status, updates.updated_at];

    let query = `UPDATE orders SET ${fields} WHERE order_number = ?`;
    const params = [...values, orderId];

    // If userId provided, ensure user owns the order
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return null;
    }

    return await this.findById(orderId);
  }

  // Cancel order
  static async cancel(orderId, userId) {
    // Check if order can be cancelled
    const order = await this.findById(orderId);
    if (!order) return null;

    if (order.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const now = new Date();
    // Use order_date to calculate 30 min if cancelDeadline is not set
    const cancelDeadline = order.cancelDeadline
      ? new Date(order.cancelDeadline)
      : new Date(new Date(order.order_date).getTime() + 30 * 60 * 1000);

    // Check if within cancel deadline
    if (now > cancelDeadline) {
      throw new Error("Cancel deadline has passed");
    }

    // Only allow cancel if order is NEW or CONFIRMED
    if (["NEW", "CONFIRMED"].includes(order.status)) {
      return await this.updateStatus(orderId, "CANCELLED", userId);
    }

    // If step 3 (PREPARING), switch to CANCEL_REQUESTED
    if (order.status === "PREPARING") {
      return await this.updateStatus(orderId, "CANCEL_REQUESTED", userId);
    }

    throw new Error("Cannot cancel order in current status");
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
      userId: order.user_id,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name || "",
        productImage: item.product_image_url || item.product_image || "",
        price: parseFloat(item.unit_price || item.price || 0),
        quantity: item.quantity,
      })),
      totalAmount: parseFloat(order.total_amount),
      shippingAddress: {
        fullName: order.customer_name || "",
        phoneNumber: order.customer_phone || "",
        address: addressParts[0] || "",
        ward: addressParts[1] || "",
        district: addressParts[2] || "",
        city: addressParts[3] || "",
        note: order.notes || "",
      },
      paymentMethod: order.payment_method,
      status: order.status,
      createdAt: order.created_at,
      confirmedAt: order.status === "CONFIRMED" ? order.updated_at : null,
      cancelledAt: order.status === "CANCELLED" ? order.updated_at : null,
      deliveredAt: order.delivered_date,
      cancelDeadline: order.order_date
        ? new Date(new Date(order.order_date).getTime() + 30 * 60 * 1000)
        : null,
      canCancel,
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
