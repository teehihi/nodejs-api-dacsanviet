const { pool } = require('../config/database');

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

      // Insert order
      const [orderResult] = await connection.query(
        `INSERT INTO orders (
          id, user_id, total_amount,
          shipping_full_name, shipping_phone, shipping_address,
          shipping_ward, shipping_district, shipping_city, shipping_note,
          payment_method, status, cancel_deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)`,
        [
          id,
          userId,
          totalAmount,
          shippingAddress.fullName,
          shippingAddress.phoneNumber,
          shippingAddress.address,
          shippingAddress.ward,
          shippingAddress.district,
          shippingAddress.city,
          shippingAddress.note || null,
          paymentMethod,
          cancelDeadline,
        ]
      );

      // Insert order items
      for (const item of items) {
        await connection.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, product_image, price, quantity
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.productId,
            item.productName,
            item.productImage,
            item.price,
            item.quantity,
          ]
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
      WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) return null;

    const order = orders[0];

    // Get order items
    const [items] = await pool.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [orderId]
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
          [order.id]
        );
        return this.formatOrder(order, items);
      })
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
    const updates = { status };
    const now = new Date();

    // Set timestamp based on status
    if (status === 'CONFIRMED') {
      updates.confirmed_at = now;
    } else if (status === 'CANCELLED') {
      updates.cancelled_at = now;
    } else if (status === 'DELIVERED') {
      updates.delivered_at = now;
    }

    const fields = Object.keys(updates)
      .map((key) => `${this.camelToSnake(key)} = ?`)
      .join(', ');
    const values = Object.values(updates);

    let query = `UPDATE orders SET ${fields} WHERE id = ?`;
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
      throw new Error('Unauthorized');
    }

    const now = new Date();
    const cancelDeadline = new Date(order.cancelDeadline);

    // Check if within cancel deadline
    if (now > cancelDeadline) {
      throw new Error('Cancel deadline has passed');
    }

    // If preparing, request cancellation instead
    if (order.status === 'PREPARING') {
      return await this.updateStatus(orderId, 'CANCEL_REQUESTED', userId);
    }

    // Otherwise, cancel directly
    if (['NEW', 'CONFIRMED'].includes(order.status)) {
      return await this.updateStatus(orderId, 'CANCELLED', userId);
    }

    throw new Error('Cannot cancel order in current status');
  }

  // Get order statistics
  static async getStats(userId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as new_orders,
        SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'PREPARING' THEN 1 ELSE 0 END) as preparing_orders,
        SUM(CASE WHEN status = 'SHIPPING' THEN 1 ELSE 0 END) as shipping_orders,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
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
      ['NEW', 'CONFIRMED', 'PREPARING'].includes(order.status) &&
      order.cancel_deadline &&
      new Date() < new Date(order.cancel_deadline);

    return {
      id: order.id,
      userId: order.user_id,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productImage: item.product_image,
        price: parseFloat(item.price),
        quantity: item.quantity,
      })),
      totalAmount: parseFloat(order.total_amount),
      shippingAddress: {
        fullName: order.shipping_full_name,
        phoneNumber: order.shipping_phone,
        address: order.shipping_address,
        ward: order.shipping_ward,
        district: order.shipping_district,
        city: order.shipping_city,
        note: order.shipping_note,
      },
      paymentMethod: order.payment_method,
      status: order.status,
      createdAt: order.created_at,
      confirmedAt: order.confirmed_at,
      cancelledAt: order.cancelled_at,
      deliveredAt: order.delivered_at,
      cancelDeadline: order.cancel_deadline,
      canCancel,
    };
  }

  // Helper: Convert camelCase to snake_case
  static camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

module.exports = Order;
