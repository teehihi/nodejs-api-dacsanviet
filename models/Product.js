const { pool } = require('../config/database');

class Product {
    // Tìm kiếm và lọc sản phẩm
    static async findAll({ q, minPrice, maxPrice, category, sort, limit = 20, offset = 0 }) {
        try {
            console.log('🔍 Product.findAll called with:', { q, minPrice, maxPrice, category, sort, limit, offset });
            
            // Convert bit(1) to boolean for easier handling
            let query = `
        SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
               p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
               p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
               CAST(p.is_active AS UNSIGNED) as is_active,
               CAST(p.is_featured AS UNSIGNED) as is_featured,
               c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE CAST(p.is_active AS UNSIGNED) = 1
      `;
            const params = [];

            // Filter by search keyword
            if (q) {
                query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
                const searchTerm = `%${q}%`;
                params.push(searchTerm, searchTerm);
            }

            // Filter by price range
            if (minPrice !== undefined && minPrice !== null) {
                query += ` AND p.price >= ?`;
                params.push(parseFloat(minPrice));
            }
            if (maxPrice !== undefined && maxPrice !== null) {
                query += ` AND p.price <= ?`;
                params.push(parseFloat(maxPrice));
            }

            // Filter by category
            if (category && category !== 'All') {
                query += ` AND c.name = ?`;
                params.push(category);
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

            // Pagination - use string interpolation to avoid MySQL2 parameter issues with LIMIT/OFFSET
            const limitValue = parseInt(limit) || 20;
            const offsetValue = parseInt(offset) || 0;
            query += ` LIMIT ${limitValue} OFFSET ${offsetValue}`;

            console.log('📝 Final query:', query);
            console.log('📝 Query params:', params);

            const [rows] = await pool.execute(query, params);
            const results = rows.map(Product.formatProduct);
            
            console.log('✅ Query successful, results:', results.length);
            return results;
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
        WHERE CAST(p.is_active AS UNSIGNED) = 1
      `;
            const params = [];

            if (q) {
                query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
                const searchTerm = `%${q}%`;
                params.push(searchTerm, searchTerm);
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
                query += ` AND c.name = ?`;
                params.push(category);
            }

            const [rows] = await pool.execute(query, params);
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
        SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
               p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
               p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
               CAST(p.is_active AS UNSIGNED) as is_active,
               CAST(p.is_featured AS UNSIGNED) as is_featured,
               c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND CAST(p.is_active AS UNSIGNED) = 1
      `, [id]);
            return rows.length > 0 ? Product.formatProduct(rows[0]) : null;
        } catch (error) {
            console.error('Error finding product by ID:', error);
            throw error;
        }
    }

    // Lấy danh sách danh mục có sản phẩm
    static async getCategoriesWithProducts() {
        try {
            const [rows] = await pool.execute(`
                SELECT DISTINCT c.name, COUNT(p.id) as product_count
                FROM categories c
                INNER JOIN products p ON c.id = p.category_id
                WHERE CAST(c.is_active AS UNSIGNED) = 1 
                AND CAST(p.is_active AS UNSIGNED) = 1
                GROUP BY c.id, c.name
                HAVING product_count > 0
                ORDER BY c.name
            `);
            return rows.map(row => ({
                name: row.name,
                productCount: row.product_count
            }));
        } catch (error) {
            console.error('Error getting categories with products:', error);
            throw error;
        }
    }

    // Lấy sản phẩm bán chạy nhất
    static async getBestSellers(limit = 10) {
        try {
            const [rows] = await pool.execute(`
                SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
                       p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
                       p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
                       CAST(p.is_active AS UNSIGNED) as is_active,
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE CAST(p.is_active AS UNSIGNED) = 1
                ORDER BY p.sold_quantity DESC, p.created_at DESC
                LIMIT ${parseInt(limit)}
            `);
            return rows.map(Product.formatProduct);
        } catch (error) {
            console.error('Error getting best sellers:', error);
            throw error;
        }
    }

    // Lấy sản phẩm giảm giá (sắp xếp theo % giảm giá)
    static async getDiscountedProducts(limit = 20) {
        try {
            // Tạm thời sử dụng logic giảm giá 20% cho tất cả sản phẩm
            // Trong tương lai có thể thêm cột discount_percentage vào database
            const [rows] = await pool.execute(`
                SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
                       p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
                       p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
                       CAST(p.is_active AS UNSIGNED) as is_active,
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name,
                       20 as discount_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE CAST(p.is_active AS UNSIGNED) = 1
                ORDER BY p.price DESC, p.created_at DESC
                LIMIT ${parseInt(limit)}
            `);
            return rows.map(row => {
                const product = Product.formatProduct(row);
                product.discountPercentage = row.discount_percentage;
                product.originalPrice = product.price;
                product.price = product.price * (1 - row.discount_percentage / 100);
                return product;
            });
        } catch (error) {
            console.error('Error getting discounted products:', error);
            throw error;
        }
    }

    // Format product data
    static formatProduct(dbProduct) {
        if (!dbProduct) return null;
        return {
            id: dbProduct.id,
            name: dbProduct.name,
            description: dbProduct.description || dbProduct.short_description || '',
            price: parseFloat(dbProduct.price),
            originalPrice: null, // Schema doesn't have original_price
            category: dbProduct.category_name || 'Uncategorized',
            imageUrl: dbProduct.image_url || '',
            rating: 4.5, // Schema doesn't have rating yet, default 4.5
            soldCount: dbProduct.sold_quantity || 0,
            isActive: dbProduct.is_active === 1,
            createdAt: dbProduct.created_at
        };
    }

    // Lấy danh sách danh mục (legacy method)
    static async getAllCategories() {
        try {
            const [rows] = await pool.execute(
                'SELECT DISTINCT name FROM categories WHERE CAST(is_active AS UNSIGNED) = 1 ORDER BY name'
            );
            return rows.map(row => row.name);
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    }
}

module.exports = Product;