-- =====================================================
-- Migration: Create product_reviews, loyalty_points, point_transactions, coupons tables
-- =====================================================

-- Bảng đánh giá sản phẩm
CREATE TABLE IF NOT EXISTS product_reviews (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    product_id  INT NOT NULL,
    order_id    BIGINT NOT NULL,          -- refers to orders.id (numeric PK)
    rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Mỗi user chỉ được đánh giá 1 sản phẩm 1 lần trong 1 đơn hàng
    UNIQUE KEY uq_user_product_order (user_id, product_id, order_id),

    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,

    INDEX idx_product_id (product_id),
    INDEX idx_user_id    (user_id),
    INDEX idx_order_id   (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng điểm tích lũy (1 hàng / user)
CREATE TABLE IF NOT EXISTS loyalty_points (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL UNIQUE,
    total_points INT NOT NULL DEFAULT 0,
    used_points  INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lịch sử giao dịch điểm
CREATE TABLE IF NOT EXISTS point_transactions (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    points      INT NOT NULL,   -- dương = nhận, âm = dùng
    type        VARCHAR(50) NOT NULL,  -- EARN_REVIEW, EARN_ORDER, SPEND_ORDER ...
    description VARCHAR(255),
    ref_id      BIGINT,         -- review_id hoặc order_id
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng mã giảm giá (coupon)
CREATE TABLE IF NOT EXISTS coupons (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    discount_type       ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
    discount_value      DECIMAL(10,2) NOT NULL,
    max_discount_amount DECIMAL(10,2),          -- giới hạn số tiền giảm tối đa
    min_order_amount    DECIMAL(10,2) DEFAULT 0,
    source              VARCHAR(50) DEFAULT 'MANUAL', -- REVIEW_REWARD, MANUAL, ...
    user_id             INT,                     -- NULL = dùng chung, có user_id = riêng tư
    is_used             TINYINT(1) DEFAULT 0,
    used_at             TIMESTAMP NULL,
    expires_at          TIMESTAMP NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_code    (code),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm cột delivered_at vào orders nếu chưa có  
-- (dùng để tính thời hạn đánh giá 10 ngày)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL;
