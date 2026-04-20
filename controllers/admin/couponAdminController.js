const { pool } = require('../../config/database');

// GET all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 50, isActive, type } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM coupons WHERE 1=1';
    const params = [];

    if (isActive !== undefined) {
      query += ` AND is_active = ?`;
      params.push(isActive === 'true' ? 1 : 0);
    }

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [coupons] = await pool.query(query, params);

    // Get usage count for each coupon
    const couponsWithUsage = await Promise.all(
      coupons.map(async (coupon) => {
        const [usage] = await pool.query(
          'SELECT COUNT(*) as used_count FROM coupon_usages WHERE coupon_id = ?',
          [coupon.id]
        );
        return { ...coupon, used_count: usage[0].used_count };
      })
    );

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM coupons');

    res.json({
      success: true,
      data: couponsWithUsage,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST create coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code, type, value, min_order_amount, max_discount_amount,
      usage_limit, valid_from, valid_to, description, is_active,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO coupons (
        code, type, value, min_order_amount, max_discount_amount,
        usage_limit, valid_from, valid_to, description, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        code.toUpperCase(), type, value, min_order_amount || 0,
        max_discount_amount || null, usage_limit || null,
        valid_from, valid_to, description, is_active !== false ? 1 : 0,
      ]
    );

    const [coupon] = await pool.query('SELECT * FROM coupons WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Tạo mã giảm giá thành công',
      data: coupon[0],
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Mã giảm giá đã tồn tại' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.code) {
      updates.code = updates.code.toUpperCase();
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    await pool.query(
      `UPDATE coupons SET ${fields}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    const [coupon] = await pool.query('SELECT * FROM coupons WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cập nhật mã giảm giá thành công',
      data: coupon[0],
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if coupon has been used
    const [usage] = await pool.query(
      'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ?',
      [id]
    );

    if (usage[0].count > 0) {
      // Soft delete if used
      await pool.query('UPDATE coupons SET is_active = 0 WHERE id = ?', [id]);
      return res.json({
        success: true,
        message: 'Mã giảm giá đã được vô hiệu hóa (đã có người sử dụng)',
      });
    }

    // Hard delete if not used
    await pool.query('DELETE FROM coupons WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Xóa mã giảm giá thành công',
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH toggle active status
exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE coupons SET is_active = NOT is_active WHERE id = ?',
      [id]
    );

    const [coupon] = await pool.query('SELECT * FROM coupons WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: coupon[0],
    });
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET coupon stats
exports.getCouponStats = async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_coupons,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_coupons,
        SUM(CASE WHEN valid_to < NOW() THEN 1 ELSE 0 END) as expired_coupons,
        (SELECT COUNT(*) FROM coupon_usages) as total_usages,
        (SELECT SUM(discount_amount) FROM coupon_usages) as total_discount_given
      FROM coupons
    `);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error('Get coupon stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
