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
               p.discount_percent, p.discount_price,
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
                query += ` AND p.name LIKE ?`;
                const searchTerm = `%${q}%`;
                params.push(searchTerm);
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
                const ids = category.split(',').map(id => id.trim()).filter(id => id);
                if (ids.length > 0) {
                    const placeholders = ids.map(() => '?').join(',');
                    query += ` AND p.category_id IN (${placeholders})`;
                    params.push(...ids);
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
        SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
               p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
               p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
               p.discount_percent, p.discount_price,
               CAST(p.is_active AS UNSIGNED) as is_active,
               CAST(p.is_featured AS UNSIGNED) as is_featured,
               c.name as category_name,
               (SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = p.id) as reviewCount,
               (SELECT IFNULL(AVG(rating), 0) FROM product_reviews pr WHERE pr.product_id = p.id) as avgRating,
               (SELECT COUNT(DISTINCT o.user_id) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = p.id AND o.status IN ('DELIVERED', 'COMPLETED')) as buyerCount
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
                SELECT c.id, c.name, COUNT(p.id) as product_count
                FROM categories c
                INNER JOIN products p ON c.id = p.category_id
                WHERE CAST(c.is_active AS UNSIGNED) = 1 
                AND CAST(p.is_active AS UNSIGNED) = 1
                GROUP BY c.id, c.name
                HAVING product_count > 0
                ORDER BY c.name
            `);
            return rows.map(row => ({
                id: row.id,
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
                       p.discount_percent, p.discount_price,
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
    static async getDiscountedProducts(limit = 20, offset = 0) {
        try {
            const limitValue = parseInt(limit) || 20;
            const offsetValue = parseInt(offset) || 0;

            // Prioritize products with actual discounts
            const [rows] = await pool.execute(`
                SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
                       p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
                       p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
                       p.discount_percent, p.discount_price,
                       CAST(p.is_active AS UNSIGNED) as is_active,
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE CAST(p.is_active AS UNSIGNED) = 1
                ORDER BY p.discount_percent DESC, p.created_at DESC
                LIMIT ${limitValue} OFFSET ${offsetValue}
            `);

            return rows.map(Product.formatProduct);
        } catch (error) {
            console.error('Error getting discounted products:', error);
            throw error;
        }
    }

    // Format product data
    static formatProduct(dbProduct) {
        if (!dbProduct) return null;

        const originalPrice = parseFloat(dbProduct.price);
        let finalPrice = originalPrice;
        let discountPercentage = 0;

        if (dbProduct.discount_percent && dbProduct.discount_percent > 0) {
            discountPercentage = dbProduct.discount_percent;
            finalPrice = originalPrice * (1 - discountPercentage / 100);
        } else if (dbProduct.discount_price && dbProduct.discount_price > 0 && dbProduct.discount_price < originalPrice) {
            // If discount_price is explicitly set (assumed to be the final price or amount off? Let's assume amount off usually, but user named it discount_price, might be 'price after discount'. 
            // Common pattern: if discount_price exists, it's the new price.
            // BUT user added 'discount_price DECIMAL'. 
            // Let's assume standard behavior: if percent exists, default to that. If not, check discount_price.
            // Actually, simplest is: if discount_percent is present, use it.
            // If not, just show original price.
            // I will stick to discount_percent as primary.
        }

        return {
            id: dbProduct.id,
            name: dbProduct.name,
            description: dbProduct.description || dbProduct.short_description || '',
            price: finalPrice,
            originalPrice: discountPercentage > 0 ? originalPrice : null,
            discountPercentage: discountPercentage > 0 ? discountPercentage : null,
            category: dbProduct.category_name || 'Uncategorized',
            imageUrl: dbProduct.image_url || '',
            rating: 4.5, // Schema doesn't have rating yet, default 4.5
            soldCount: dbProduct.sold_quantity || 0,
            isActive: dbProduct.is_active === 1,
            createdAt: dbProduct.created_at,
            avgRating: dbProduct.avgRating || 0,
            reviewCount: dbProduct.reviewCount || 0,
            buyerCount: dbProduct.buyerCount || 0
        };
    }

    // Thêm phương thức lấy sản phẩm tương tự
    static async getSimilarProducts(productId, limit = 10) {
        try {
            // First get the category of this product
            const [prodRows] = await pool.execute('SELECT category_id FROM products WHERE id = ?', [productId]);
            if (prodRows.length === 0) return [];

            const categoryId = prodRows[0].category_id;

            // Then get other products in same category
            const [rows] = await pool.execute(`
                SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
                       p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
                       p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
                       p.discount_percent, p.discount_price,
                       CAST(p.is_active AS UNSIGNED) as is_active,
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.category_id = ? AND p.id != ? AND CAST(p.is_active AS UNSIGNED) = 1
                ORDER BY p.sold_quantity DESC, RAND()
                LIMIT ${parseInt(limit)}
            `, [categoryId, productId]);

            return rows.map(Product.formatProduct);
        } catch (error) {
            console.error('Error getting similar products:', error);
            throw error;
        }
    }

    // Thêm phương thức lấy sản phẩm đã xem gần đây
    static async getRecentlyViewed(userId, limit = 10) {
        if (!userId) return [];
        try {
            const [rows] = await pool.execute(`
                SELECT p.id, p.name, p.description, p.short_description, p.price, p.image_url, 
                       p.origin, p.stock_quantity, p.story, p.story_image_url, p.weight_grams,
                       p.created_at, p.updated_at, p.category_id, p.supplier_id, p.sold_quantity,
                       p.discount_percent, p.discount_price,
                       CAST(p.is_active AS UNSIGNED) as is_active,
                       CAST(p.is_featured AS UNSIGNED) as is_featured,
                       c.name as category_name,
                       MAX(v.viewed_at) as last_viewed
                FROM product_views v
                JOIN products p ON v.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE v.user_id = ? AND CAST(p.is_active AS UNSIGNED) = 1
                GROUP BY p.id
                ORDER BY last_viewed DESC
                LIMIT ${parseInt(limit)}
            `, [userId]);

            return rows.map(Product.formatProduct);
        } catch (error) {
            console.error('Error getting recently viewed products:', error);
            throw error;
        }
    }

    // Phương thức track lượt xem
    static async trackView(userId, productId) {
        if (!userId || !productId) return;
        try {
            await pool.execute(
                'INSERT INTO product_views (user_id, product_id) VALUES (?, ?)',
                [userId, productId]
            );
        } catch (error) {
            console.error('Error tracking view:', error);
        }
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
