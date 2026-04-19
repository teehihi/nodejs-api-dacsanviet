const mysql = require('mysql2/promise');
require('dotenv').config();

// Cấu hình database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'DacSanViet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Tạo connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    console.log(`Database: ${dbConfig.database}`);
    console.log(`Host: ${dbConfig.host}:${dbConfig.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    return false;
  }
};

// Kiểm tra và tạo bảng cần thiết cho API (nếu chưa có)
const ensureApiTables = async () => {
  try {
    // Kiểm tra bảng users có tồn tại không và lấy cấu trúc
    const [userTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [dbConfig.database]);

    if (userTables.length === 0) {
      // Tạo bảng users nếu chưa có
      const createUsersTable = `
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) DEFAULT '',
          address TEXT DEFAULT '',
          role ENUM('admin', 'user', 'customer') DEFAULT 'user',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP NULL,
          INDEX idx_email (email),
          INDEX idx_username (username),
          INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await pool.execute(createUsersTable);
      console.log('Users table created');
    } else {
      console.log('Users table already exists');

      // Lấy thông tin về cột id của bảng users
      const [userColumns] = await pool.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
      `, [dbConfig.database]);

      if (userColumns.length > 0) {
        console.log(`Users table ID column type: ${userColumns[0].COLUMN_TYPE}`);
      }
    }

    // Kiểm tra bảng api_sessions
    const [sessionTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'api_sessions'
    `, [dbConfig.database]);

    if (sessionTables.length === 0) {
      // Lấy thông tin về cột id của bảng users để tạo foreign key tương thích
      const [userIdColumn] = await pool.execute(`
        SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
      `, [dbConfig.database]);

      let userIdType = 'INT';
      if (userIdColumn.length > 0) {
        userIdType = userIdColumn[0].COLUMN_TYPE;
      }

      // Tạo bảng api_sessions với user_id tương thích
      const createSessionsTable = `
        CREATE TABLE api_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id ${userIdType} NOT NULL,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          INDEX idx_session_id (session_id),
          INDEX idx_user_id (user_id),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await pool.execute(createSessionsTable);
      console.log('API Sessions table created');

      // Thêm foreign key constraint sau khi tạo bảng
      try {
        await pool.execute(`
          ALTER TABLE api_sessions 
          ADD CONSTRAINT fk_api_sessions_user_id 
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log('Foreign key constraint added');
      } catch (fkError) {
        console.log('Could not add foreign key constraint (table will work without it):', fkError.message);
      }
    } else {
      console.log('API Sessions table already exists');
    }

    // Kiểm tra bảng otp_codes
    const [otpTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'otp_codes'
    `, [dbConfig.database]);

    if (otpTables.length === 0) {
      // Tạo bảng otp_codes
      const createOTPTable = `
        CREATE TABLE otp_codes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(100) NOT NULL,
          otp_code VARCHAR(10) NOT NULL,
          purpose ENUM('registration', 'password_reset') NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          used_at TIMESTAMP NULL,
          INDEX idx_email (email),
          INDEX idx_otp_code (otp_code),
          INDEX idx_purpose (purpose),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await pool.execute(createOTPTable);
      console.log('OTP Codes table created');
    } else {
      console.log('OTP Codes table already exists');

      // Check if metadata column exists
      const [otpColumns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'otp_codes' AND COLUMN_NAME = 'metadata'
      `, [dbConfig.database]);

      if (otpColumns.length === 0) {
        try {
          await pool.execute('ALTER TABLE otp_codes ADD COLUMN metadata JSON NULL');
          console.log('Added metadata column to otp_codes');
        } catch (alterError) {
          console.error('Error adding metadata column:', alterError.message);
        }
      }
    }

    // Add coupon and points columns to orders table if they don't exist
    try {
      const [orderCols] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME IN ('coupon_code', 'discount_amount', 'points_used')
      `, [dbConfig.database]);

      const existingCols = orderCols.map(c => c.COLUMN_NAME);

      if (!existingCols.includes('coupon_code')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL');
        console.log('Added coupon_code column to orders');
      }
      if (!existingCols.includes('discount_amount')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0');
        console.log('Added discount_amount column to orders');
      }
      if (!existingCols.includes('points_used')) {
        await pool.execute('ALTER TABLE orders ADD COLUMN points_used INT DEFAULT 0');
        console.log('Added points_used column to orders');
      }
    } catch (orderAltError) {
      console.error('Error altering orders table:', orderAltError.message);
    }

    // Kiểm tra và tạo bảng product_reviews
    const [reviewTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_reviews'
    `, [dbConfig.database]);

    if (reviewTables.length === 0) {
      const createReviewsTable = `
        CREATE TABLE product_reviews (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          order_id INT NOT NULL,
          rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
          comment TEXT,
          is_approved BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_product_id (product_id),
          INDEX idx_order_id (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createReviewsTable);
      console.log('Product Reviews table created');
    } else {
      console.log('Product Reviews table already exists');
    }

    // Kiểm tra và tạo bảng loyalty_points
    const [lpTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'loyalty_points'
    `, [dbConfig.database]);

    if (lpTables.length === 0) {
      const createLPTable = `
        CREATE TABLE loyalty_points (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT UNIQUE NOT NULL,
          total_points INT DEFAULT 0,
          used_points INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createLPTable);
      console.log('Loyalty Points table created');
    } else {
      console.log('Loyalty Points table already exists');
    }

    // Kiểm tra và tạo bảng point_transactions
    const [ptTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'point_transactions'
    `, [dbConfig.database]);

    if (ptTables.length === 0) {
      const createPTTable = `
        CREATE TABLE point_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          points INT NOT NULL,
          type ENUM('EARN_REVIEW', 'EARN_PURCHASE', 'SPEND_ORDER') NOT NULL,
          description VARCHAR(255),
          ref_id INT, -- Có thể là order_id hoặc review_id
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createPTTable);
      console.log('Point Transactions table created');
    } else {
      console.log('Point Transactions table already exists');
    }

    // Kiểm tra và tạo bảng product_favorites
    const [pfTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_favorites'
    `, [dbConfig.database]);

    if (pfTables.length === 0) {
      const createPFTable = `
        CREATE TABLE product_favorites (
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createPFTable);
      console.log('Product Favorites table created');
    } else {
      console.log('Product Favorites table already exists');
    }

    // Kiểm tra và tạo bảng product_views
    const [pvTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_views'
    `, [dbConfig.database]);

    if (pvTables.length === 0) {
      const createPVTable = `
        CREATE TABLE product_views (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_product_id (product_id),
          INDEX idx_viewed_at (viewed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createPVTable);
      console.log('Product Views table created');
    } else {
      console.log('Product Views table already exists');
    }

    // Kiểm tra và tạo bảng coupons
    const [couponTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'coupons'
    `, [dbConfig.database]);

    if (couponTables.length === 0) {
      const createCouponTable = `
        CREATE TABLE coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_type ENUM('PERCENT', 'FIXED') NOT NULL,
          discount_value DECIMAL(10, 2) NOT NULL,
          min_order_amount DECIMAL(10, 2) DEFAULT 0,
          max_discount_amount DECIMAL(10, 2),
          max_uses INT DEFAULT 1,
          used_count INT DEFAULT 0,
          source ENUM('SYSTEM', 'REVIEW_REWARD') DEFAULT 'SYSTEM',
          user_id INT, -- Nếu NULL thì ai cũng dùng được, nếu có ID thì chỉ người đó dùng được
          expires_at TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_code (code),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createCouponTable);
      console.log('Coupons table created');
    } else {
      console.log('Coupons table already exists');
    }

    // Kiểm tra và tạo bảng coupon_usages
    const [cuTables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'coupon_usages'
    `, [dbConfig.database]);

    if (cuTables.length === 0) {
      const createCUTable = `
        CREATE TABLE coupon_usages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          coupon_id INT NOT NULL,
          user_id INT NOT NULL,
          order_id INT NOT NULL,
          discount_applied DECIMAL(10, 2) NOT NULL,
          used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_coupon_id (coupon_id),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await pool.execute(createCUTable);
      console.log('Coupon Usages table created');
    } else {
      console.log('Coupon Usages table already exists');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring API tables:', error.message);
    return false;
  }
};

// Tạo admin user mặc định
const createDefaultAdmin = async () => {
  try {
    const bcrypt = require('bcryptjs');

    // Kiểm tra admin đã tồn tại chưa
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR role = ? LIMIT 1',
      ['admin@dacsanviet.com', 'ADMIN']
    );

    if (rows.length > 0) {
      console.log('Admin user already exists');
      return true;
    }

    // Lấy cấu trúc bảng users để tạo admin phù hợp
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);

    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log('Available user columns:', columnNames.join(', '));

    // Tạo admin mới với các cột có sẵn
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Chuẩn bị dữ liệu admin dựa trên cấu trúc bảng
    const adminData = {
      username: 'admin',
      email: 'admin@dacsanviet.com',
      password: hashedPassword,
      full_name: 'Administrator',
      phone_number: '0123456789',
      role: 'ADMIN'
    };

    // Chỉ sử dụng các cột tồn tại
    const availableFields = Object.keys(adminData).filter(field => columnNames.includes(field));
    const values = availableFields.map(field => adminData[field]);
    const placeholders = availableFields.map(() => '?').join(', ');

    const insertQuery = `
      INSERT INTO users (${availableFields.join(', ')})
      VALUES (${placeholders})
    `;

    await pool.execute(insertQuery, values);

    console.log('Default admin user created');
    console.log('Email: admin@dacsanviet.com');
    console.log('Password: admin123');
    return true;
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    // Không fail nếu không tạo được admin (có thể đã có user khác)
    return true;
  }
};

// Lấy thông tin database schema
const getDatabaseInfo = async () => {
  try {
    // Lấy danh sách tables
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [dbConfig.database]);

    // Lấy thông tin về users table
    const [userColumns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `, [dbConfig.database]);

    return {
      database: dbConfig.database,
      totalTables: tables.length,
      tables: tables.map(table => ({
        name: table.TABLE_NAME,
        rows: table.TABLE_ROWS,
        dataSize: table.DATA_LENGTH,
        indexSize: table.INDEX_LENGTH
      })),
      usersTableColumns: userColumns.map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        default: col.COLUMN_DEFAULT
      }))
    };
  } catch (error) {
    console.error('Error getting database info:', error.message);
    return null;
  }
};

// Initialize database
const initializeDatabase = async () => {
  console.log('Connecting to existing DacSanViet database...');

  const connected = await testConnection();
  if (!connected) return false;



  const tablesEnsured = await ensureApiTables();
  if (!tablesEnsured) return false;



  const adminCreated = await createDefaultAdmin();
  if (!adminCreated) return false;

  // Hiển thị thông tin database
  const dbInfo = await getDatabaseInfo();
  if (dbInfo) {
    console.log(`Database has ${dbInfo.totalTables} tables`);
    console.log(`Users table has ${dbInfo.usersTableColumns.length} columns`);
  }

  console.log('Database connection established!');
  return true;
};

// Cleanup expired sessions and OTPs
const cleanupExpiredSessions = async () => {
  try {
    // Clean up expired sessions
    const [sessionResult] = await pool.execute(
      'DELETE FROM api_sessions WHERE expires_at < NOW() OR is_active = FALSE'
    );

    if (sessionResult.affectedRows > 0) {
      console.log(`Cleaned up ${sessionResult.affectedRows} expired sessions`);
    }

    // Clean up expired OTPs
    const [otpResult] = await pool.execute(
      'DELETE FROM otp_codes WHERE expires_at < NOW() OR (is_used = TRUE AND used_at < DATE_SUB(NOW(), INTERVAL 1 DAY))'
    );

    if (otpResult.affectedRows > 0) {
      console.log(`Cleaned up ${otpResult.affectedRows} expired OTPs`);
    }
  } catch (error) {
    console.error('Error cleaning up expired data:', error.message);
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  cleanupExpiredSessions,
  getDatabaseInfo
};