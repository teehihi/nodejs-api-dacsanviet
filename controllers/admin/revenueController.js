const { pool } = require('../../config/database');

const getDateFilter = (req) => {
  const { startDate, endDate } = req.query;
  let dateFilter = '';
  if (startDate && endDate) {
    dateFilter = `AND COALESCE(o.delivered_at, o.created_at) >= '${startDate} 00:00:00' AND COALESCE(o.delivered_at, o.created_at) <= '${endDate} 23:59:59'`;
  }
  return dateFilter;
};

// GET revenue overview
exports.getRevenueOverview = async (req, res) => {
  try {
    const dateFilter = getDateFilter(req);
    const params = [];

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
        SUM(CASE WHEN status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPING','SHIPPED') THEN total_amount ELSE 0 END) as pending_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(NOW())
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN total_amount ELSE 0 
        END) as current_month_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(NOW())
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN 1 ELSE 0 
        END) as current_month_count,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          AND YEAR(delivered_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          THEN total_amount ELSE 0 
        END) as last_month_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND YEARWEEK(delivered_at, 1) = YEARWEEK(NOW(), 1)
          THEN total_amount ELSE 0 
        END) as current_week_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND YEARWEEK(delivered_at, 1) = YEARWEEK(NOW(), 1)
          THEN 1 ELSE 0 
        END) as current_week_count,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND DATE(delivered_at) = CURDATE()
          THEN total_amount ELSE 0 
        END) as today_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND DATE(delivered_at) = CURDATE()
          THEN 1 ELSE 0 
        END) as today_count,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN total_amount ELSE 0 
        END) as current_year_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN 1 ELSE 0 
        END) as current_year_count
      FROM orders o
      WHERE 1=1 ${dateFilter}
    `, params);

    // Doanh thu theo ngày - Tuần hiện tại (Thứ 2 -> Chủ nhật)
    // DAYOFWEEK: 1=CN, 2=T2, 3=T3, 4=T4, 5=T5, 6=T6, 7=T7
    const [daily] = await pool.query(`
      WITH RECURSIVE date_range AS (
        -- Tính ngày Thứ 2 đầu tuần
        -- Nếu hôm nay là CN (1) thì lùi 6 ngày, nếu T2 (2) thì lùi 0 ngày, T3 (3) thì lùi 1 ngày...
        SELECT DATE_SUB(CURDATE(), INTERVAL 
          CASE 
            WHEN DAYOFWEEK(CURDATE()) = 1 THEN 6  -- Chủ nhật
            ELSE DAYOFWEEK(CURDATE()) - 2         -- T2-T7
          END DAY
        ) as date
        UNION ALL
        SELECT DATE_ADD(date, INTERVAL 1 DAY)
        FROM date_range
        WHERE date < DATE_ADD(
          DATE_SUB(CURDATE(), INTERVAL 
            CASE 
              WHEN DAYOFWEEK(CURDATE()) = 1 THEN 6
              ELSE DAYOFWEEK(CURDATE()) - 2
            END DAY
          ), INTERVAL 6 DAY
        )
      )
      SELECT
        dr.date,
        COALESCE(COUNT(o.id), 0) as order_count,
        COALESCE(SUM(o.total_amount), 0) as revenue
      FROM date_range dr
      LEFT JOIN orders o ON DATE(o.delivered_at) = dr.date 
        AND o.status = 'DELIVERED'
        AND o.delivered_at IS NOT NULL
      GROUP BY dr.date
      ORDER BY dr.date ASC
    `);

    // Doanh thu theo tháng (12 tháng gần nhất) - dựa vào delivered_at
    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(delivered_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE status = 'DELIVERED'
        AND delivered_at IS NOT NULL
        AND delivered_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(delivered_at, '%Y-%m')
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
      WHERE o.status = 'DELIVERED' ${dateFilter}
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
    const dateFilter = getDateFilter(req);
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
      WHERE o.status = 'DELIVERED' ${dateFilter}
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
    const dateFilter = getDateFilter(req);
    const [methods] = await pool.query(`
      SELECT
        payment_method,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue
      FROM orders o
      WHERE o.status = 'DELIVERED' ${dateFilter}
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

// GET unified dashboard data
exports.getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = getDateFilter(req);
    
    // Overview stats
    const [revenue] = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as delivered_revenue,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'CANCELLED' THEN total_amount ELSE 0 END) as cancelled_revenue,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status IN ('PENDING','CONFIRMED','PROCESSING','SHIPPING','SHIPPED') THEN total_amount ELSE 0 END) as pending_revenue
      FROM orders o
      WHERE 1=1 ${dateFilter}
    `);

    // Top Products
    const [topProducts] = await pool.query(`
      SELECT
        p.id, p.name, p.price,
        SUM(oi.quantity) as total_sold,
        SUM(oi.quantity * oi.unit_price) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'DELIVERED' ${dateFilter}
      GROUP BY p.id, p.name, p.price
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    // Categories
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
      WHERE o.status = 'DELIVERED' ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `);

    // Payments
    const [paymentMethods] = await pool.query(`
      SELECT
        payment_method,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue
      FROM orders o
      WHERE o.status = 'DELIVERED' ${dateFilter}
      GROUP BY payment_method
      ORDER BY total_revenue DESC
    `);

    // Hardcoded 12 months trend (no date filter as requested)
    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(delivered_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE status = 'DELIVERED'
        AND delivered_at IS NOT NULL
        AND delivered_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(delivered_at, '%Y-%m')
      ORDER BY month DESC
    `);

    // Dynamic Chart Data
    let diffDays = 7;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      diffDays = (end - start) / (1000 * 60 * 60 * 24);
    }

    let chartQuery = '';
    let groupType = 'daily';

    if (diffDays <= 1) { // 1 day
      groupType = 'hourly';
      chartQuery = `
        SELECT 
          DATE_FORMAT(COALESCE(o.delivered_at, o.created_at), '%Y-%m-%d %H:00:00') as label,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as revenue
        FROM orders o
        WHERE 1=1 ${dateFilter} AND o.status = 'DELIVERED'
        GROUP BY label
        ORDER BY label ASC
      `;
    } else if (diffDays <= 31) { // Up to 1 month
      groupType = 'daily';
      chartQuery = `
        SELECT 
          DATE_FORMAT(COALESCE(o.delivered_at, o.created_at), '%Y-%m-%d') as label,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as revenue
        FROM orders o
        WHERE 1=1 ${dateFilter} AND o.status = 'DELIVERED'
        GROUP BY label
        ORDER BY label ASC
      `;
    } else { // Greater than 1 month
      groupType = 'monthly';
      chartQuery = `
        SELECT 
          DATE_FORMAT(COALESCE(o.delivered_at, o.created_at), '%Y-%m') as label,
          COUNT(o.id) as order_count,
          SUM(o.total_amount) as revenue
        FROM orders o
        WHERE 1=1 ${dateFilter} AND o.status = 'DELIVERED'
        GROUP BY label
        ORDER BY label ASC
      `;
    }

    // Global Stats (unaffected by dateFilter) for Home Screen
    const [globalStats] = await pool.query(`
      SELECT
        -- All-time revenue
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as all_time_revenue,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as all_time_orders,
        -- Current month
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(NOW())
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN total_amount ELSE 0 
        END) as current_month_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(NOW())
          AND YEAR(delivered_at) = YEAR(NOW())
          THEN 1 ELSE 0 
        END) as current_month_orders,
        -- Last month
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          AND YEAR(delivered_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          THEN total_amount ELSE 0 
        END) as last_month_revenue,
        SUM(CASE 
          WHEN status = 'DELIVERED' 
          AND delivered_at IS NOT NULL
          AND MONTH(delivered_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          AND YEAR(delivered_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
          THEN 1 ELSE 0 
        END) as last_month_orders
      FROM orders
    `);

    const [chartData] = await pool.query(chartQuery);

    res.json({
      success: true,
      data: {
        global: globalStats[0],
        overview: revenue[0],
        chartData,
        groupType,
        topProducts,
        categories,
        paymentMethods,
        monthly
      },
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

