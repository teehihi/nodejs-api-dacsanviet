const { pool } = require('../config/database');

class OTP {
  constructor(otpData) {
    this.email = otpData.email;
    this.otpCode = otpData.otpCode;
    this.purpose = otpData.purpose; // 'registration' or 'password_reset'
    this.expiresAt = otpData.expiresAt;
    this.isUsed = false;
  }

  // Tạo OTP mới
  static async create(otpData) {
    try {
      const otp = new OTP(otpData);
      
      const [result] = await pool.execute(`
        INSERT INTO otp_codes (email, otp_code, purpose, expires_at, is_used, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        otp.email,
        otp.otpCode,
        otp.purpose,
        otp.expiresAt,
        otp.isUsed,
        otpData.metadata || null
      ]);

      if (result.affectedRows > 0) {
        return await OTP.findById(result.insertId);
      }
      return null;
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw error;
    }
  }

  // Tìm OTP theo ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM otp_codes WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? OTP.formatOTP(rows[0]) : null;
    } catch (error) {
      console.error('Error finding OTP by ID:', error);
      throw error;
    }
  }

  // Tìm OTP hợp lệ theo email và mã OTP
  static async findValidOTP(email, otpCode, purpose) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM otp_codes 
        WHERE email = ? AND otp_code = ? AND purpose = ? 
        AND is_used = FALSE AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [email, otpCode, purpose]);
      
      return rows.length > 0 ? OTP.formatOTP(rows[0]) : null;
    } catch (error) {
      console.error('Error finding valid OTP:', error);
      throw error;
    }
  }

  // Đánh dấu OTP đã sử dụng
  static async markAsUsed(id) {
    try {
      const [result] = await pool.execute(
        'UPDATE otp_codes SET is_used = TRUE, used_at = NOW() WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error marking OTP as used:', error);
      throw error;
    }
  }

  // Vô hiệu hóa tất cả OTP cũ của email cho mục đích cụ thể
  static async invalidateOldOTPs(email, purpose) {
    try {
      const [result] = await pool.execute(
        'UPDATE otp_codes SET is_used = TRUE WHERE email = ? AND purpose = ? AND is_used = FALSE',
        [email, purpose]
      );
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error invalidating old OTPs:', error);
      throw error;
    }
  }

  // Xóa OTP hết hạn
  static async cleanupExpiredOTPs() {
    try {
      const [result] = await pool.execute(
        'DELETE FROM otp_codes WHERE expires_at < NOW() OR (is_used = TRUE AND used_at < DATE_SUB(NOW(), INTERVAL 1 DAY))'
      );
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
      throw error;
    }
  }

  // Lấy thống kê OTP
  static async getStats() {
    try {
      const [totalRows] = await pool.execute('SELECT COUNT(*) as count FROM otp_codes');
      const [activeRows] = await pool.execute('SELECT COUNT(*) as count FROM otp_codes WHERE is_used = FALSE AND expires_at > NOW()');
      const [usedRows] = await pool.execute('SELECT COUNT(*) as count FROM otp_codes WHERE is_used = TRUE');
      const [expiredRows] = await pool.execute('SELECT COUNT(*) as count FROM otp_codes WHERE expires_at <= NOW()');
      const [todayRows] = await pool.execute('SELECT COUNT(*) as count FROM otp_codes WHERE DATE(created_at) = CURDATE()');
      
      return {
        totalOTPs: totalRows[0].count,
        activeOTPs: activeRows[0].count,
        usedOTPs: usedRows[0].count,
        expiredOTPs: expiredRows[0].count,
        todayOTPs: todayRows[0].count
      };
    } catch (error) {
      console.error('Error getting OTP stats:', error);
      throw error;
    }
  }

  // Lấy lịch sử OTP của email
  static async getOTPHistory(email, limit = 10) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM otp_codes 
        WHERE email = ?
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit)}
      `, [email]);
      
      return rows.map(OTP.formatOTP);
    } catch (error) {
      console.error('Error getting OTP history:', error);
      throw error;
    }
  }

  // Kiểm tra rate limit - giới hạn số lần gửi OTP
  static async checkRateLimit(email, purpose, timeWindow = 300000, maxAttempts = 3) {
    try {
      const timeWindowStart = new Date(Date.now() - timeWindow);
      
      const [rows] = await pool.execute(`
        SELECT COUNT(*) as count FROM otp_codes 
        WHERE email = ? AND purpose = ? AND created_at > ?
      `, [email, purpose, timeWindowStart]);
      
      return rows[0].count < maxAttempts;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    }
  }

  // Format OTP data
  static formatOTP(dbOTP) {
    if (!dbOTP) return null;
    
    return {
      id: dbOTP.id,
      email: dbOTP.email,
      otpCode: dbOTP.otp_code,
      purpose: dbOTP.purpose,
      createdAt: dbOTP.created_at,
      expiresAt: dbOTP.expires_at,
      isUsed: dbOTP.is_used,
      usedAt: dbOTP.used_at,
      metadata: dbOTP.metadata // Thêm metadata field
    };
  }

  // Tạo mã OTP ngẫu nhiên
  static generateOTPCode(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // Tính thời gian hết hạn
  static calculateExpiryTime(minutes = 5) {
    return new Date(Date.now() + (minutes * 60 * 1000));
  }
}

module.exports = OTP;