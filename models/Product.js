const { pool } = require('../config/database');

class Product {
    // Tìm kiếm và lọc sản phẩm
    static async findAll({ q, minPrice, maxPrice, category, sort, limit = 20, offset = 0 }) {
        try {
            let query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1
      `;
            const params = [];

            // Filter by search keyword
            if (q) {
                query += ` AND p.name LIKE ?`;
                const searchTerm = `%${q}%`;
                params.push(searchTerm);
            }

            // Filter by price range
            if (minPrice) {
                query += ` AND p.price >= ?`;
                params.push(parseFloat(minPrice));
            }
            if (maxPrice) {
                query += ` AND p.price <= ?`;
                params.push(parseFloat(maxPrice));
            }

            // Filter by category
            if (category && category !== 'All') {
                const cats = category.split(',').map(c => c.trim()).filter(c => c);
                if (cats.length > 0) {
                    const placeholders = cats.map(() => '?').join(',');
                    query += ` AND p.category_id IN (${placeholders})`;
                    params.push(...cats);
                }
            }

            // Sorting
            if (sort) {
                switch (sort) {
                    case 'price_asc':
                        query += ` ORDER BY p.price ASC`;
                        break;
                    case 'price_desc':
                        query += ` ORDER BY p.price DESC`;
                        break;
                    case 'newest':
                        query += ` ORDER BY p.created_at DESC`;
                        break;
                    default:
                        query += ` ORDER BY p.created_at DESC`;
                }
            } else {
                query += ` ORDER BY p.created_at DESC`;
            }

            // Pagination
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));
            const [rows] = await pool.query(query, params);
            return rows.map(Product.formatProduct);
        } catch (error) {
            console.error('Error finding products:', error);
            throw error;
        }
    }

    // Đếm tổng số sản phẩm
    static async count({ q, minPrice, maxPrice, category }) {
        try {
            let query = `
        SELECT COUNT(*) as count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1
      `;
            const params = [];

            if (q) {
                query += ` AND p.name LIKE ?`;
                const searchTerm = `%${q}%`;
                params.push(searchTerm);
            }
            if (minPrice) {
                query += ` AND p.price >= ?`;
                params.push(parseFloat(minPrice));
            }
            if (maxPrice) {
                query += ` AND p.price <= ?`;
                params.push(parseFloat(maxPrice));
            }
            if (category && category !== 'All') {
                const ids = category.split(',').map(id => id.trim()).filter(id => id);
                if (ids.length > 0) {
                    const placeholders = ids.map(() => '?').join(',');
                    query += ` AND p.category_id IN (${placeholders})`;
                    params.push(...ids);
                }
            }

            const [rows] = await pool.query(query, params);
            return rows[0].count;
        } catch (error) {
            console.error('Error counting products:', error);
            throw error;
        }
    }

    // Lấy chi tiết sản phẩm
    static async findById(id) {
        try {
            const [rows] = await pool.execute(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.is_active = 1
      `, [id]);
            return rows.length > 0 ? Product.formatProduct(rows[0]) : null;
        } catch (error) {
            console.error('Error finding product by ID:', error);
            throw error;
        }
    }

    // Lấy danh sách danh mục
    static async getAllCategories() {
        try {
            const [rows] = await pool.execute(
                'SELECT id, name FROM categories ORDER BY name'
            );
            return rows;
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    }

    // Format product data
    static formatProduct(dbProduct) {
        if (!dbProduct) return null;
        return {
            id: dbProduct.id,
            name: dbProduct.name,
            description: dbProduct.description,
            price: parseFloat(dbProduct.price),
            originalPrice: null, // Schema doesn't have original_price
            category: dbProduct.category_name || 'Uncategorized',
            imageUrl: dbProduct.image_url,
            rating: 5.0, // Schema doesn't have rating yet, default 5
            soldCount: 0, // Schema doesn't have sold_count
            isActive: dbProduct.is_active === 1 || (dbProduct.is_active && dbProduct.is_active[0] === 1),
            createdAt: dbProduct.created_at
        };
    }
}

module.exports = Product;
