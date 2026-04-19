const Product = require('../../models/Product');
const { pool } = require('../../config/database');

// GET all products (admin view with filters)
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 50, category, isActive, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    if (isActive !== undefined) {
      query += ` AND p.is_active = ?`;
      params.push(isActive === 'true' ? 1 : 0);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [products] = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
    const countParams = [];
    if (category) {
      countQuery += ` AND c.name = ?`;
      countParams.push(category);
    }
    if (isActive !== undefined) {
      countQuery += ` AND p.is_active = ?`;
      countParams.push(isActive === 'true' ? 1 : 0);
    }
    if (search) {
      countQuery += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST create product
exports.createProduct = async (req, res) => {
  try {
    const {
      name, description, short_description, price, category_id,
      supplier_id, stock_quantity, origin, weight_grams,
      discount_percent, is_active, is_featured,
    } = req.body;

    const discount_price = discount_percent
      ? price * (1 - discount_percent / 100)
      : null;

    const [result] = await pool.query(
      `INSERT INTO products (
        name, description, short_description, price, category_id,
        supplier_id, stock_quantity, origin, weight_grams,
        discount_percent, discount_price, is_active, is_featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        name, description, short_description, price, category_id,
        supplier_id, stock_quantity || 0, origin, weight_grams,
        discount_percent || null, discount_price, is_active !== false ? 1 : 0,
        is_featured ? 1 : 0,
      ]
    );

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công',
      data: product[0],
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Recalculate discount_price if discount_percent or price changed
    if (updates.discount_percent !== undefined || updates.price !== undefined) {
      const [current] = await pool.query('SELECT price, discount_percent FROM products WHERE id = ?', [id]);
      if (current.length > 0) {
        const price = updates.price !== undefined ? updates.price : current[0].price;
        const discount = updates.discount_percent !== undefined ? updates.discount_percent : current[0].discount_percent;
        updates.discount_price = discount ? price * (1 - discount / 100) : null;
      }
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    await pool.query(
      `UPDATE products SET ${fields}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cập nhật sản phẩm thành công',
      data: product[0],
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Xóa sản phẩm thành công (soft delete)',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH toggle active status
exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE products SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?',
      [id]
    );

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: product[0],
    });
  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET product stats
exports.getProductStats = async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
        SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured_products,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN discount_percent > 0 THEN 1 ELSE 0 END) as discounted_products,
        AVG(price) as avg_price,
        SUM(sold_quantity) as total_sold
      FROM products
    `);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
