const { pool } = require('../config/database');

class Category {
    static async findAll() {
        try {
            const [rows] = await pool.execute(`
                SELECT id, name, description, image_url, parent_id,
                       CAST(is_active AS UNSIGNED) as is_active,
                       created_at, updated_at
                FROM categories
                ORDER BY name ASC
            `);
            return rows;
        } catch (error) {
            console.error('Error finding categories:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            const [rows] = await pool.execute(`
                SELECT id, name, description, image_url, parent_id,
                       CAST(is_active AS UNSIGNED) as is_active,
                       created_at, updated_at
                FROM categories
                WHERE id = ?
            `, [id]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error finding category by ID:', error);
            throw error;
        }
    }

    static async create(data) {
        try {
            const { name, description, image_url, parent_id, is_active } = data;
            // Ensure is_active is 0 or 1 for BIT(1), default to 1 (active)
            const activeValue = (is_active === 'false' || is_active === false || is_active === 0) ? 0 : 1;
            
            const [result] = await pool.execute(`
                INSERT INTO categories (name, description, image_url, parent_id, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                name, 
                description || null, 
                image_url || null, 
                parent_id || null, 
                activeValue
            ]);
            
            return result.insertId;
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    }

    static async update(id, data) {
        try {
            const updates = [];
            const params = [];
            
            if (data.name !== undefined) {
                updates.push('name = ?');
                params.push(data.name);
            }
            if (data.description !== undefined) {
                updates.push('description = ?');
                params.push(data.description);
            }
            if (data.image_url !== undefined) {
                updates.push('image_url = ?');
                params.push(data.image_url);
            }
            if (data.parent_id !== undefined) {
                updates.push('parent_id = ?');
                params.push(data.parent_id);
            }
            if (data.is_active !== undefined) {
                updates.push('is_active = ?');
                const activeValue = (data.is_active === 'false' || data.is_active === false || data.is_active === 0) ? 0 : 1;
                params.push(activeValue);
            }
            
            if (updates.length === 0) return false;
            
            updates.push('updated_at = NOW()');
            const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
            params.push(id);
            
            const [result] = await pool.execute(query, params);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            // Kiểm tra xem có sản phẩm nào thuộc category này không trước khi xóa (hoặc set category_id của chúng về null)
            await pool.execute('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
            
            const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }

    // Lấy tất cả sản phẩm thuộc category
    static async getProducts(categoryId) {
        try {
            const [rows] = await pool.execute(`
                SELECT p.*, 
                       CAST(p.is_active AS UNSIGNED) as is_active, 
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.category_id = ?
                ORDER BY p.name ASC
            `, [categoryId]);
            return rows;
        } catch (error) {
            console.error('Error getting products for category:', error);
            throw error;
        }
    }
    
    // Thêm sản phẩm vào category
    static async addProductToCategory(categoryId, productId) {
        try {
            const [result] = await pool.execute(
                'UPDATE products SET category_id = ? WHERE id = ?',
                [categoryId, productId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error adding product to category:', error);
            throw error;
        }
    }
}

module.exports = Category;
