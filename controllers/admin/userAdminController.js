const User = require('../../models/User');
const { pool } = require('../../config/database');

// GET all users with advanced filters
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role, isActive, search, sortBy = 'created_at', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND is_active = ?`;
      params.push(isActive === 'true' ? 1 : 0);
    }

    if (search) {
      query += ` AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    // Get order stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [orderStats] = await pool.query(
          `SELECT
            COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as total_spent
          FROM orders WHERE user_id = ?`,
          [user.id]
        );
        return {
          ...user,
          password: undefined, // Don't send password
          total_orders: orderStats[0].total_orders,
          total_spent: parseFloat(orderStats[0].total_spent || 0),
        };
      })
    );

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');

    res.json({
      success: true,
      data: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET user detail with full stats
exports.getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User không tồn tại' });
    }

    // Get order stats
    const [orderStats] = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'DELIVERED' THEN total_amount ELSE 0 END) as total_spent,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
        MAX(created_at) as last_order_date
      FROM orders WHERE user_id = ?`,
      [id]
    );

    // Get loyalty points
    const [points] = await pool.query(
      'SELECT * FROM user_points WHERE user_id = ?',
      [id]
    );

    // Get recent orders
    const [recentOrders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...user,
        password: undefined,
        stats: orderStats[0],
        points: points[0] || { total_points: 0, used_points: 0, current_balance: 0 },
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN', 'STAFF'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role không hợp lệ' });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    const user = await User.findById(id);

    res.json({
      success: true,
      message: 'Cập nhật role thành công',
      data: { ...user, password: undefined },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET user stats
exports.getUserStats = async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) as regular_users,
        SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) as admin_users,
        SUM(CASE WHEN role = 'STAFF' THEN 1 ELSE 0 END) as staff_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_users_30d,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as new_users_7d
      FROM users
    `);

    // User growth by month
    const [growth] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        growth,
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST ban user (set is_active = 0)
exports.banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.query(
      'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );

    // Log ban reason (có thể tạo bảng user_bans để lưu lịch sử)
    console.log(`User ${id} banned. Reason: ${reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: 'Đã khóa tài khoản user',
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST unban user (set is_active = 1)
exports.unbanUser = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Đã mở khóa tài khoản user',
    });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
