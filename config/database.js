const mysql = require('mysql2/promise');
require('dotenv').config();

// Cấu hình database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
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