const { pool } = require('../config/database');

class Session {
  constructor(sessionData) {
    this.userId = sessionData.userId;
    this.sessionId = sessionData.sessionId;
    this.ipAddress = sessionData.ipAddress || null;
    this.userAgent = sessionData.userAgent || null;
    this.expiresAt = sessionData.expiresAt;
    this.isActive = true;
  }

  // Tạo session mới
  static async create(sessionData) {
    try {
      const session = new Session(sessionData);
      
      const [result] = await pool.execute(`
        INSERT INTO api_sessions (user_id, session_id, ip_address, user_agent, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        session.userId,
        session.sessionId,
        session.ipAddress,
        session.userAgent,
        session.expiresAt,
        session.isActive
      ]);

      if (result.affectedRows > 0) {
        return await Session.findById(result.insertId);
      }
      return null;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Tìm session theo session ID
  static async findBySessionId(sessionId) {
    try {
      const [rows] = await pool.execute(`
        SELECT s.*, u.username, u.email, u.full_name, u.role
        FROM api_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.is_active = TRUE AND s.expires_at > NOW()
      `, [sessionId]);
      
      return rows.length > 0 ? Session.formatSession(rows[0]) : null;
    } catch (error) {
      console.error('Error finding session by session ID:', error);
      throw error;
    }
  }

  // Tìm session theo ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM api_sessions WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? Session.formatSession(rows[0]) : null;
    } catch (error) {
      console.error('Error finding session by ID:', error);
      throw error;
    }
  }

  // Lấy tất cả sessions của user
  static async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT * FROM api_sessions 
        WHERE user_id = ? AND is_active = TRUE AND expires_at > NOW()
        ORDER BY created_at DESC
      `, [userId]);
      
      return rows.map(Session.formatSession);
    } catch (error) {
      console.error('Error finding sessions by user ID:', error);
      throw error;
    }
  }

  // Lấy tất cả sessions (cho admin)
  static async findAll(limit = 100, offset = 0) {
    try {
      const [rows] = await pool.execute(`
        SELECT s.*, u.username, u.email, u.full_name, u.role
        FROM api_sessions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `);
      
      return rows.map(Session.formatSession);
    } catch (error) {
      console.error('Error finding all sessions:', error);
      throw error;
    }
  }

  // Vô hiệu hóa session
  static async invalidateSession(sessionId) {
    try {
      const [result] = await pool.execute(
        'UPDATE api_sessions SET is_active = FALSE WHERE session_id = ?',
        [sessionId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error invalidating session:', error);
      throw error;
    }
  }

  // Vô hiệu hóa tất cả sessions của user
  static async invalidateUserSessions(userId) {
    try {
      const [result] = await pool.execute(
        'UPDATE api_sessions SET is_active = FALSE WHERE user_id = ?',
        [userId]
      );
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error invalidating user sessions:', error);
      throw error;
    }
  }

  // Xóa sessions hết hạn
  static async cleanupExpiredSessions() {
    try {
      const [result] = await pool.execute(
        'DELETE FROM api_sessions WHERE expires_at < NOW() OR is_active = FALSE'
      );
      
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  // Lấy thống kê sessions
  static async getStats() {
    try {
      const [totalRows] = await pool.execute('SELECT COUNT(*) as count FROM api_sessions');
      const [activeRows] = await pool.execute('SELECT COUNT(*) as count FROM api_sessions WHERE is_active = TRUE AND expires_at > NOW()');
      const [expiredRows] = await pool.execute('SELECT COUNT(*) as count FROM api_sessions WHERE expires_at <= NOW()');
      const [todayRows] = await pool.execute('SELECT COUNT(*) as count FROM api_sessions WHERE DATE(created_at) = CURDATE()');
      
      return {
        totalSessions: totalRows[0].count,
        activeSessions: activeRows[0].count,
        expiredSessions: expiredRows[0].count,
        todaySessions: todayRows[0].count
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }

  // Lấy sessions theo IP
  static async findByIpAddress(ipAddress, limit = 20) {
    try {
      const [rows] = await pool.execute(`
        SELECT s.*, u.username, u.email, u.full_name
        FROM api_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.ip_address = ?
        ORDER BY s.created_at DESC
        LIMIT ${parseInt(limit)}
      `, [ipAddress]);
      
      return rows.map(Session.formatSession);
    } catch (error) {
      console.error('Error finding sessions by IP:', error);
      throw error;
    }
  }

  // Format session data
  static formatSession(dbSession) {
    if (!dbSession) return null;
    
    return {
      id: dbSession.id,
      userId: dbSession.user_id,
      sessionId: dbSession.session_id,
      ipAddress: dbSession.ip_address,
      userAgent: dbSession.user_agent,
      createdAt: dbSession.created_at,
      expiresAt: dbSession.expires_at,
      isActive: dbSession.is_active,
      // User info if joined
      username: dbSession.username,
      email: dbSession.email,
      fullName: dbSession.full_name,
      role: dbSession.role
    };
  }
}

module.exports = Session;