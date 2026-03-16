const { pool } = require('../config/database');

class Notification {
  // Ensure table exists
  static async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSON NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT NOW()
      )
    `);
  }

  static async create({ userId = null, type, title, body, data = null }) {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())',
      [userId, type, title, body, data ? JSON.stringify(data) : null]
    );
    return { id: result.insertId, userId, type, title, body, data, isRead: false };
  }

  static async findByUserId(userId, limit = 30) {
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows.map(this.format);
  }

  static async markRead(id, userId) {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [id, userId]
    );
  }

  static async markAllRead(userId) {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL',
      [userId]
    );
  }

  static async getUnreadCount(userId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0',
      [userId]
    );
    return rows[0].count;
  }

  static format(row) {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null,
      isRead: row.is_read === 1,
      createdAt: row.created_at,
    };
  }
}

module.exports = Notification;
