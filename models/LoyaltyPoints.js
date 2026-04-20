const { pool } = require('../config/database');

class LoyaltyPoints {
    // user_points table: user_id BIGINT, total_points INT, updated_at DATETIME
    static async getBalance(userId) {
        // Calculate balance from valid transactions (to ensure it's always accurate)
        const [rows] = await pool.query(`
            SELECT IFNULL(SUM(remaining_points), 0) as current_balance
            FROM point_transactions
            WHERE user_id = ?
              AND remaining_points > 0
              AND (expires_at > NOW() OR expires_at IS NULL)
        `, [userId]);

        const balance = rows[0].current_balance;

        // Update the summary table for faster access
        await pool.query(`
            INSERT INTO loyalty_points (user_id, points_balance) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE points_balance = ?
        `, [userId, balance, balance]);

        return { current_balance: balance };
    }

    static async addPoints(connection, userId, points, type, description, refId = null) {
        // Points expire in 30 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Insert to transaction history
        await connection.query(`
            INSERT INTO point_transactions (user_id, points, remaining_points, type, description, ref_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, points, points, type, `${description} (Hết hạn sau 30 ngày)`, refId, expiresAt]);

        // Update summary balance
        await connection.query(`
            INSERT INTO loyalty_points (user_id, points_balance) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE points_balance = points_balance + ?
        `, [userId, points, points]);

        return true;
    }

    static async usePoints(connection, userId, pointsToUse, orderId) {
        // 1. Get valid earnings sorted by oldest first (FIFO)
        const [earnings] = await connection.query(`
            SELECT id, remaining_points 
            FROM point_transactions 
            WHERE user_id = ? 
              AND remaining_points > 0 
              AND (expires_at > NOW() OR expires_at IS NULL)
            ORDER BY created_at ASC
        `, [userId]);

        const totalAvailable = earnings.reduce((sum, e) => sum + e.remaining_points, 0);
        if (totalAvailable < pointsToUse) {
            throw new Error('Không đủ điểm khả dụng (điểm có thể đã hết hạn)');
        }

        let stillToUse = pointsToUse;
        for (const earning of earnings) {
            if (stillToUse <= 0) break;

            const useFromThis = Math.min(earning.remaining_points, stillToUse);
            await connection.query(
                'UPDATE point_transactions SET remaining_points = remaining_points - ? WHERE id = ?',
                [useFromThis, earning.id]
            );
            stillToUse -= useFromThis;
        }

        // 2. Record the usage transaction
        await connection.query(`
            INSERT INTO point_transactions (user_id, points, remaining_points, type, description, ref_id)
            VALUES (?, ?, 0, 'SPEND_ORDER', 'Dùng điểm cho đơn hàng', ?)
        `, [userId, -pointsToUse, orderId]);

        // 3. Update summary balance
        await connection.query(`
            UPDATE loyalty_points 
            SET points_balance = GREATEST(0, points_balance - ?)
            WHERE user_id = ?
        `, [pointsToUse, userId]);

        return true;
    }

    static async refundPoints(connection, userId, pointsToRefund, orderId) {
        // When refunding, we treat it like a new gift but maybe with the original expiry or just new 30 days?
        // User logic usually implies returning the points. Let's give them 30 new days for simplicity or better UI.
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await connection.query(`
            INSERT INTO point_transactions (user_id, points, remaining_points, type, description, ref_id, expires_at)
            VALUES (?, ?, ?, 'REFUND_ORDER', 'Hoàn điểm cho đơn hàng hủy', ?, ?)
        `, [userId, pointsToRefund, pointsToRefund, orderId, expiresAt]);

        await connection.query(`
            UPDATE loyalty_points 
            SET points_balance = points_balance + ?
            WHERE user_id = ?
        `, [pointsToRefund, userId]);

        return true;
    }

    static async getHistory(userId) {
        const [rows] = await pool.query(`
            SELECT id, points, type, description, ref_id, expires_at, created_at,
                   (expires_at < NOW() AND remaining_points > 0) as is_expired
            FROM point_transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userId]);
        return rows;
    }
}

module.exports = LoyaltyPoints;
