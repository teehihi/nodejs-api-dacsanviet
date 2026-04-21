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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)`,
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
      WHERE o.id = ? OR o.order_number = ?`,
      [orderId, orderId]
    );

    if (orders.length === 0) return null;
    return await this.formatOrder(orders[0]);
  }

  // Find orders by user ID
  static async findByUserId(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*,
             0 as reviews_count,
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
        return await this.formatOrder(order);
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
  static async updateStatus(orderId, status, userId = null, carrierName = null, cancelReason = null, paymentMethod = null, connection = null) {
    // Map new status names to DB enum values
    const statusMap = {
      'NEW': 'PENDING',
      'PREPARING': 'PROCESSING', 
      'SHIPPING': 'SHIPPED',
      'DELIVERED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
      'CONFIRMED': 'CONFIRMED'
    };
    
    const dbStatus = statusMap[status] || status;
    const updates = { status: dbStatus };
    const now = new Date();

    if (status === 'CONFIRMED') updates.confirmed_at = now;
    else if (status === 'CANCELLED') updates.cancelled_at = now;
    else if (status === 'DELIVERED') updates.delivered_at = now;
    
    if (carrierName) updates.shipping_carrier = carrierName;
    if (cancelReason) updates.notes = cancelReason; // Use notes column for cancel reason
    if (paymentMethod) updates.payment_method = paymentMethod;

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    // Check if orderId is numeric or string to avoid SQL type mismatch
    const isNumeric = !isNaN(orderId) && !isNaN(parseFloat(orderId));
    let query = `UPDATE orders SET ${fields}, updated_at = NOW() WHERE `;
    const params = [...values];
    
    if (isNumeric) {
      query += `id = ?`;
      params.push(orderId);
    } else {
      query += `order_number = ?`;
      params.push(orderId);
    }

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
                         0 as reviews_count,
                         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
      FROM orders o LEFT JOIN users u ON o.user_id = u.id`;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`o.status = ?`);
      params.push(status);
    }
    if (options.userId) {
      conditions.push(`o.user_id = ?`);
      params.push(options.userId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [orders] = await pool.query(query, params);
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        return await this.formatOrder(order); // Now handles item fetching internally
      })
    );

    let countQuery = `SELECT COUNT(*) as total FROM orders`;
    const countParams = [];
    if (status || options.userId) {
      countQuery += ` WHERE `;
      const countConditions = [];
      if (status) {
        countConditions.push(`status = ?`);
        countParams.push(status);
      }
      if (options.userId) {
        countConditions.push(`user_id = ?`);
        countParams.push(options.userId);
      }
      countQuery += countConditions.join(' AND ');
    }
    const [countResult] = await pool.query(countQuery, countParams);

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
  /** Convert a Date (or mysql2 datetime string) to Vietnam-timezone ISO string */
  static toVNString(dt) {
    if (!dt) return null;
    const d = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(d)) return null;
    // Shift to UTC+7
    const vnMs = d.getTime() + 7 * 60 * 60 * 1000;
    const vn = new Date(vnMs);
    const pad = n => String(n).padStart(2, '0');
    return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth()+1)}-${pad(vn.getUTCDate())}T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}+07:00`;
  }

  static async formatOrder(order, providedItems = null) {
    let items = providedItems;
    if (!items) {
      const [rows] = await pool.query(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [order.id]
      );
      items = rows;
    }

    const addressParts = order.shipping_address_text
      ? order.shipping_address_text.split(", ")
      : [];

    // Extract name and phone from shipping_address_text
    const customerName = order.customer_name || addressParts[0] || "Khách hàng";
    const customerPhone = order.customer_phone || addressParts[1] || "";
    const displayAddress = addressParts.slice(2).join(", ") || order.shipping_address_text || "";

    // Map database statuses to match Flutter UI expectations
    let finalStatus = (order.status || 'PENDING').toUpperCase();
    // Map DB enum to UI status names
    if (finalStatus === 'PENDING') finalStatus = 'NEW';
    if (finalStatus === 'PROCESSING') finalStatus = 'PREPARING';
    if (finalStatus === 'SHIPPED') finalStatus = 'SHIPPING';

    return {
      id: order.id,
      orderId: order.id,
      numericId: order.id,
      code: order.order_number,
      order_number: order.order_number,
      userId: order.user_id,
      userEmail: order.email,
      userFullName: order.user_full_name,
      
      // Top-level flat fields for AppController/OrderCard
      customer_name: customerName,
      customerName: customerName,
      phone: customerPhone,
      customerPhone: customerPhone,
      shipping_address: displayAddress,
      shippingAddressText: displayAddress,         // flat string cho các màn hình cũ
      shipping_address_text: order.shipping_address_text,
      total_amount: parseFloat(order.total_amount),
      totalAmount: parseFloat(order.total_amount),
      payment_method: order.payment_method,
      paymentMethod: order.payment_method,
      status: finalStatus, // Mapped status for UI
      
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        product_id: item.product_id,
        productName: item.product_name || "",
        product_name: item.product_name || "",
        productImage: item.product_image_url || item.product_image || "",
        product_image: item.product_image_url || item.product_image || "",
        price: parseFloat(item.unit_price || item.price || 0),
        unit_price: parseFloat(item.unit_price || item.price || 0),
        quantity: item.quantity,
      })),
      shippingFee: 0,
      discountAmount: parseFloat(order.discount_amount || 0),
      pointsUsed: parseInt(order.points_used || 0),
      subtotal: parseFloat(order.total_amount) + parseFloat(order.discount_amount || 0) + parseInt(order.points_used || 0),
      
      // Nested object cho OrderDetailScreen
      shippingAddress: {
        fullName: customerName,
        phoneNumber: customerPhone,
        address: addressParts[0] || "",
        ward: addressParts[1] || "",
        district: addressParts[2] || "",
        city: addressParts[3] || "",
        note: order.notes || "",
      },
      couponCode: order.coupon_code || null,
      carrierName: order.shipping_carrier || null,
      cancelReason: order.notes || null,
      createdAt: Order.toVNString(order.order_date || order.created_at),

      created_at: Order.toVNString(order.created_at),
      order_date: Order.toVNString(order.order_date),
      confirmedAt: Order.toVNString(order.confirmed_at) || null,
      cancelledAt: Order.toVNString(order.cancelled_at) || null,
      deliveredAt: Order.toVNString(order.delivered_at) || null,
      isReviewed: (order.reviews_count !== undefined && order.items_count !== undefined)
        ? (order.reviews_count >= order.items_count && order.items_count > 0)
        : false,
      cancelDeadline: order.order_date
        ? new Date(new Date(order.order_date).getTime() + 30 * 60 * 1000)
        : null,
      canCancel: finalStatus === 'NEW' || finalStatus === 'PREPARING',
      isCancelRequested: finalStatus === 'CANCEL_REQUESTED'
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

  // Get spending statistics for a user
  static async getSpendingStats(userId) {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        IFNULL(SUM(total_amount), 0) as total_spent,
        IFNULL(SUM(CASE WHEN status = 'NEW' THEN total_amount ELSE 0 END), 0) as pending_amount,
        IFNULL(SUM(CASE WHEN status = 'SHIPPING' THEN total_amount ELSE 0 END), 0) as shipping_amount,
        IFNULL(SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) as delivered_amount,
        IFNULL(SUM(CASE WHEN status = 'CANCELLED' THEN total_amount ELSE 0 END), 0) as cancelled_amount,
        SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'SHIPPING' THEN 1 ELSE 0 END) as shipping_count,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
      FROM orders WHERE user_id = ?
    `, [userId]);

    // Monthly spending last 6 months
    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        IFNULL(SUM(total_amount), 0) as amount,
        COUNT(*) as count
      FROM orders
      WHERE user_id = ? AND status = 'DELIVERED'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `, [userId]);

    const s = rows[0];
    return {
      totalOrders: parseInt(s.total_orders),
      totalSpent: parseFloat(s.total_spent),
      pendingAmount: parseFloat(s.pending_amount),
      shippingAmount: parseFloat(s.shipping_amount),
      deliveredAmount: parseFloat(s.delivered_amount),
      cancelledAmount: parseFloat(s.cancelled_amount),
      pendingCount: parseInt(s.pending_count),
      shippingCount: parseInt(s.shipping_count),
      deliveredCount: parseInt(s.delivered_count),
      cancelledCount: parseInt(s.cancelled_count),
      monthlySpending: monthly.map(m => ({
        month: m.month,
        amount: parseFloat(m.amount),
        count: parseInt(m.count),
      })),
    };
  }
}

module.exports = Order;
