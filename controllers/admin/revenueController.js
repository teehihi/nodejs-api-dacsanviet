const { pool } = require('../../config/database');

// GET revenue overview
exports.getRevenueOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'AND o.created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    // Tổng doanh thu (chỉ tính đơn DELIVERED)
    const [revenue] = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as delivered_revenue,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN total_amount ELSE 0 END) as cancelled_revenue,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPING') THEN total_amount ELSE 0 END) as pending_revenue
      FROM orders o
      WHERE 1=1 ${dateFilter}
    `, params);

    // Doanh thu theo ngày (30 ngày gần nhất)
    const [daily] = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Doanh thu theo tháng (12 tháng gần nhất)
    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    // Top sản phẩm bán chạy
    const [topProducts] = await pool.query(`
      SELECT
        p.id, p.name, p.price,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.unit_price) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'DELIVERED'
      GROUP BY p.id, p.name, p.price
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: revenue[0],
        daily,
        monthly,
        topProducts,
      },
    });
  } catch (error) {
    console.error('Get revenue overview error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET revenue by category
exports.getRevenueByCategory = async (req, res) => {
  try {
    const [categories] = await pool.query(`
      SELECT
        c.name as category_name,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.unit_price) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'DELIVERED'
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get revenue by category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET revenue by payment method
exports.getRevenueByPaymentMethod = async (req, res) => {
  try {
    const [methods] = await pool.query(`
      SELECT
        payment_method,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE status = 'DELIVERED'
      GROUP BY payment_method
      ORDER BY total_revenue DESC
    `);

    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('Get revenue by payment method error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET profit analysis (doanh thu - chi phí)
// Note: Hiện tại chưa có bảng chi phí, tạm tính profit = revenue * 0.3 (30% margin)
exports.getProfitAnalysis = async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as revenue,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount * 0.3 ELSE 0 END) as estimated_profit
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data,
      note: 'Profit tạm tính = Revenue * 30% (chưa có dữ liệu chi phí thực tế)',
    });
  } catch (error) {
    console.error('Get profit analysis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET customer lifetime value (CLV)
exports.getCustomerLifetimeValue = async (req, res) => {
  try {
    const [customers] = await pool.query(`
      SELECT
        u.id as user_id,
        u.full_name,
        u.email,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE 0 END) as lifetime_value,
        AVG(CASE WHEN o.status = 'DELIVERED' THEN o.total_amount ELSE NULL END) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'USER'
      GROUP BY u.id, u.full_name, u.email
      HAVING total_orders > 0
      ORDER BY lifetime_value DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Get customer lifetime value error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
