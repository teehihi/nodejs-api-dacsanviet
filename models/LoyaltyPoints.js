const { pool } = require('../config/database');

class LoyaltyPoints {
    // user_points table: user_id BIGINT, total_points INT, updated_at DATETIME
    static async getBalance(userId) {
        const [rows] = await pool.query(
            'SELECT total_points FROM user_points WHERE user_id = ?',
            [userId]
        );
        const [spent] = await pool.query(
            'SELECT IFNULL(SUM(ABS(points)), 0) as used_points FROM point_transactions WHERE user_id = ? AND points < 0',
            [userId]
        );
        const total = rows.length > 0 ? parseInt(rows[0].total_points) : 0;
        const used = parseInt(spent[0].used_points);
        return { total_points: total, used_points: used, current_balance: total - used };
    }

    static async addPoints(connection, userId, points, type, description, refId = null) {
        await connection.query(
            'INSERT INTO user_points (user_id, total_points, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE total_points = total_points + ?, updated_at = NOW()',
            [userId, points, points]
        );
        await connection.query(
            'INSERT INTO point_transactions (user_id, points, type, description, review_id) VALUES (?, ?, \'EARN\', ?, ?)',
            [userId, points, description, refId]
        );
        return true;
    }

    static async usePoints(connection, userId, pointsToUse, orderId) {
        const balance = await LoyaltyPoints.getBalance(userId);
        if (balance.current_balance < pointsToUse) {
            throw new Error('Không đủ điểm để sử dụng');
        }
        await connection.query(
            'UPDATE user_points SET total_points = total_points - ?, updated_at = NOW() WHERE user_id = ?',
            [pointsToUse, userId]
        );
        await connection.query(
            'INSERT INTO point_transactions (user_id, points, type, description, order_id) VALUES (?, ?, \'REDEEM\', \'Dùng điểm cho đơn hàng\', ?)',
            [userId, -pointsToUse, orderId]
        );
        return true;
    }

    static async getHistory(userId) {
        const [rows] = await pool.query(
            'SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        return rows;
    }
}

module.exports = LoyaltyPoints;
