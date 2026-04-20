const { pool } = require('../config/database');

class ProductQA {
    static async findByProductId(productId) {
        const [rows] = await pool.query(`
            SELECT qa.*, u.avatar_url, u.full_name
            FROM product_qa qa
            LEFT JOIN users u ON qa.user_id = u.id
            WHERE qa.product_id = ? AND qa.parent_id IS NULL AND (qa.is_visible = 1 OR qa.is_visible IS NULL)
            ORDER BY qa.created_at DESC
        `, [productId]);

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
        
        // Format main avatars
        rows.forEach(row => {
            if (row.avatar_url && !row.avatar_url.startsWith('http')) {
                row.avatar_url = `${baseUrl}/${row.avatar_url}`;
            }
        });

        // Fetch replies for each question
        for (let row of rows) {
            const [replies] = await pool.query(`
                SELECT qa.*, u.avatar_url, u.full_name
                FROM product_qa qa
                LEFT JOIN users u ON qa.user_id = u.id
                WHERE qa.parent_id = ? AND (qa.is_visible = 1 OR qa.is_visible IS NULL)
                ORDER BY qa.created_at ASC
            `, [row.id]);
            
            // Format reply avatars
            replies.forEach(rp => {
                if (rp.avatar_url && !rp.avatar_url.startsWith('http')) {
                    rp.avatar_url = `${baseUrl}/${rp.avatar_url}`;
                }
            });
            row.replies = replies;
        }

        return rows;
    }

    static async create({ productId, userId, userName, userEmail, content, parentId = null }) {
        const [result] = await pool.query(`
            INSERT INTO product_qa (product_id, user_id, user_name, user_email, question, parent_id, created_at, updated_at, is_visible)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)
        `, [productId, userId, userName, userEmail, content, parentId]);
        
        return result.insertId;
    }
}

module.exports = ProductQA;
