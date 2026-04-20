-- Add discount columns to products table
ALTER TABLE products 
ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0 COMMENT 'Discount percentage (0-100)',
ADD COLUMN discount_price DECIMAL(10,2) DEFAULT NULL COMMENT 'Final price after discount';

-- Add indexes for better performance
CREATE INDEX idx_product_discount ON products(discount_percent, is_active);

-- Update some sample products with discounts for testing
UPDATE products SET discount_percent = 20 WHERE id IN (1, 2, 3);
UPDATE products SET discount_percent = 15 WHERE id IN (4, 5);
UPDATE products SET discount_percent = 25 WHERE id IN (6, 7);

-- Verify the changes
SELECT id, name, price, discount_percent, 
       ROUND(price * (1 - discount_percent/100), 2) as discounted_price
FROM products 
WHERE discount_percent > 0 
LIMIT 5;