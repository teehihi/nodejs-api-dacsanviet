const { pool } = require('../config/database');

class LoyaltyPoints {
    static async getBalance(userId) {
        const [rows] = await pool.query(
            'SELECT total_points, used_points, (total_points - used_points) as current_balance FROM loyalty_points WHERE user_id = ?',
            [userId]
        );
        if (rows.length === 0) return { total_points: 0, used_points: 0, current_balance: 0 };
        return rows[0];
    }

    static async addPoints(connection, userId, points, type, description, refId = null) {
        // Requires a connection to be passed in for transaction safety
        // Insert or update loyalty_points table
        await connection.query(`
      INSERT INTO loyalty_points (user_id, total_points) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE total_points = total_points + ?
    `, [userId, points, points]);

        // Insert to transaction history
        await connection.query(`
      INSERT INTO point_transactions (user_id, points, type, description, ref_id)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, points, type, description, refId]);

        return true;
    }

    static async usePoints(connection, userId, pointsToUse, orderId) {
        // Check balance
        const [rows] = await connection.query(
            'SELECT (total_points - used_points) as current_balance FROM loyalty_points WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0 || rows[0].current_balance < pointsToUse) {
            throw new Error('Không đủ điểm để sử dụng');
        }

        // Update balance
        await connection.query(`
      UPDATE loyalty_points 
      SET used_points = used_points + ?
      WHERE user_id = ?
    `, [pointsToUse, userId]);

        // Insert to transaction history
        await connection.query(`
      INSERT INTO point_transactions (user_id, points, type, description, ref_id)
      VALUES (?, ?, 'SPEND_ORDER', 'Dùng điểm cho đơn hàng', ?)
    `, [userId, -pointsToUse, orderId]);

        return true;
    }

    static async getHistory(userId) {
        const [rows] = await pool.query(
            'SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows;
    }
}

module.exports = LoyaltyPoints;
