const { pool } = require('../config/database');

class Favorite {
    static async toggle(userId, productId) {
        const [existing] = await pool.query(
            'SELECT * FROM product_favorites WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );

        if (existing.length > 0) {
            await pool.query('DELETE FROM product_favorites WHERE user_id = ? AND product_id = ?', [userId, productId]);
            return { liked: false };
        } else {
            await pool.query('INSERT INTO product_favorites (user_id, product_id) VALUES (?, ?)', [userId, productId]);
            return { liked: true };
        }
    }

    static async findByUserId(userId) {
        // Left join similar to product finding
        const [rows] = await pool.query(`
      SELECT f.created_at as favorited_at, p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
               p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
               p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
               p.discount_percent, p.discount_price,
               CAST(p.is_active AS UNSIGNED) as is_active,
               CAST(p.is_featured AS UNSIGNED) as is_featured,
               c.name as category_name
      FROM product_favorites f
      JOIN products p ON f.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE f.user_id = ? AND CAST(p.is_active AS UNSIGNED) = 1
      ORDER BY f.created_at DESC
    `, [userId]);
        return rows;
    }

    static async isLiked(userId, productId) {
        if (!userId) return false;
        const [existing] = await pool.query(
            'SELECT 1 FROM product_favorites WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );
        return existing.length > 0;
    }
}

module.exports = Favorite;
