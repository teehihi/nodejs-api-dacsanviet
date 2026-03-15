const { pool } = require('./config/database');

async function run() {
    try {
        const query = "ALTER TABLE orders MODIFY COLUMN status ENUM('PENDING', 'NEW', 'CONFIRMED', 'PROCESSING', 'PREPARING', 'SHIPPED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'CANCEL_REQUESTED') DEFAULT 'NEW'";
        console.log("Executing:", query);
        await pool.query(query);
        console.log("Success! Status column altered.");
    } catch (e) {
        console.error("Error altering status:", e);
    } finally {
        process.exit(0);
    }
}
run();
