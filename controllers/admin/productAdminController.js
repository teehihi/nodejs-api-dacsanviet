const Product = require('../../models/Product');
const { pool } = require('../../config/database');
const fs = require('fs');
const path = require('path');

// Helper to remove diacritics for MySQL search (optional as MySQL collation usually handles this, 
// but if not, we can use a simpler approach or just trust the user's input).
// For now, I'll stick to standard LIKE but adjust the controller logic to handle file uploads.

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

    // Load images for each product
    for (let product of products) {
      const [images] = await pool.query(
        'SELECT id, image_url, is_primary, display_order, alt_text FROM product_images WHERE product_id = ? ORDER BY display_order ASC, is_primary DESC',
        [product.id]
      );
      product.images = images;
      // Set primary image as image_url for backward compatibility
      if (images.length > 0) {
        const primaryImage = images.find(img => img.is_primary) || images[0];
        product.image_url = primaryImage.image_url;
      }
    }

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
      data: {
        products: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit),
        }
      }
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

    // Parse numeric values properly (multipart sends everything as strings)
    const parsedPrice = parseInt(price) || 0;
    const parsedStock = parseInt(stock_quantity) || 0;
    const parsedDiscount = discount_percent ? parseFloat(discount_percent) : null;
    const parsedWeight = weight_grams ? parseInt(weight_grams) : null;

    const discount_price = parsedDiscount
      ? parsedPrice * (1 - parsedDiscount / 100)
      : null;

    // Create product first (without image_url in main table)
    const [result] = await pool.query(
      `INSERT INTO products (
        name, description, short_description, price, category_id,
        supplier_id, stock_quantity, origin, weight_grams,
        discount_percent, discount_price, is_active, is_featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        name, description || name, short_description || null, parsedPrice, category_id,
        supplier_id || null, parsedStock, origin || null, parsedWeight,
        parsedDiscount, discount_price, is_active !== false ? 1 : 0,
        is_featured ? 1 : 0,
      ]
    );

    const productId = result.insertId;

    // Handle multiple image uploads
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const image_url = '/' + file.path.replace(/\\/g, '/').replace('public/', '');
        
        await pool.query(
          `INSERT INTO product_images (product_id, image_url, display_order, is_primary, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [productId, image_url, i, i === 0 ? 1 : 0] // First image is primary
        );
      }

      // Update main product table with primary image for backward compatibility
      const [primaryImage] = await pool.query(
        'SELECT image_url FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1',
        [productId]
      );
      if (primaryImage.length > 0) {
        await pool.query(
          'UPDATE products SET image_url = ? WHERE id = ?',
          [primaryImage[0].image_url, productId]
        );
      }
    } else if (req.body.image_url) {
      // Fallback: single image URL from body
      await pool.query(
        'UPDATE products SET image_url = ? WHERE id = ?',
        [req.body.image_url, productId]
      );
      await pool.query(
        `INSERT INTO product_images (product_id, image_url, display_order, is_primary, created_at) 
         VALUES (?, ?, 0, 1, NOW())`,
        [productId, req.body.image_url]
      );
    }

    // Fetch complete product with images
    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    const [images] = await pool.query(
      'SELECT id, image_url, is_primary, display_order, alt_text FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [productId]
    );
    product[0].images = images;

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
    const updates = { ...req.body };

    // Parse numeric values properly (multipart sends everything as strings)
    if (updates.price !== undefined) updates.price = parseInt(updates.price) || 0;
    if (updates.stock_quantity !== undefined) updates.stock_quantity = parseInt(updates.stock_quantity) || 0;
    if (updates.weight_grams !== undefined) updates.weight_grams = parseInt(updates.weight_grams) || null;
    if (updates.discount_percent !== undefined) updates.discount_percent = parseFloat(updates.discount_percent) || null;

    // Handle Multiple Image Uploads
    if (req.files && req.files.length > 0) {
      // Get old images to delete
      const [oldImages] = await pool.query('SELECT image_url FROM product_images WHERE product_id = ?', [id]);
      
      // Delete old image files
      for (const oldImg of oldImages) {
        if (oldImg.image_url && oldImg.image_url.startsWith('/uploads/')) {
          const oldPath = path.join(__dirname, '../../public', oldImg.image_url);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }

      // Delete old image records
      await pool.query('DELETE FROM product_images WHERE product_id = ?', [id]);

      // Insert new images
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const image_url = '/' + file.path.replace(/\\/g, '/').replace('public/', '');
        
        await pool.query(
          `INSERT INTO product_images (product_id, image_url, display_order, is_primary, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [id, image_url, i, i === 0 ? 1 : 0]
        );
      }

      // Update main product table with primary image
      const [primaryImage] = await pool.query(
        'SELECT image_url FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1',
        [id]
      );
      if (primaryImage.length > 0) {
        updates.image_url = primaryImage[0].image_url;
      }
    }

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

    if (fields) {
      await pool.query(
        `UPDATE products SET ${fields}, updated_at = NOW() WHERE id = ?`,
        [...values, id]
      );
    }

    // Fetch complete product with images
    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    const [images] = await pool.query(
      'SELECT id, image_url, is_primary, display_order, alt_text FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [id]
    );
    product[0].images = images;

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
