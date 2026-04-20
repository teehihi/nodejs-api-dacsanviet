/**
 * 🛠️ Script test cập nhật trạng thái đơn hàng
 * 
 * Cách dùng:
 *   node test-order.js list                          → Xem danh sách đơn hàng
 *   node test-order.js update <ORDER_ID> <STATUS>    → Cập nhật trạng thái
 * 
 * Ví dụ:
 *   node test-order.js list
 *   node test-order.js update ORD1773643094606854 PREPARING
 *   node test-order.js update ORD1773643094606854 SHIPPING
 *   node test-order.js update ORD1773643094606854 DELIVERED
 * 
 * Các trạng thái hợp lệ:
 *   NEW              → Đơn hàng mới
 *   CONFIRMED        → Đã xác nhận
 *   PREPARING        → Shop đang chuẩn bị hàng
 *   SHIPPING         → Đang giao hàng
 *   DELIVERED        → Giao thành công
 *   CANCELLED        → Đã hủy
 *   CANCEL_REQUESTED → Yêu cầu hủy đơn
 */

require('dotenv').config();
const { pool } = require('./config/database');
const Notification = require('./models/Notification');
const LoyaltyPoints = require('./models/LoyaltyPoints');
const Order = require('./models/Order');

const VALID_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'CANCEL_REQUESTED'];

const STATUS_LABELS = {
    NEW: 'Đơn hàng mới',
    CONFIRMED: 'Đã xác nhận',
    PREPARING: 'Shop đang chuẩn bị hàng',
    SHIPPING: 'Đang giao hàng',
    DELIVERED: 'Giao thành công',
    CANCELLED: 'Đã hủy',
    CANCEL_REQUESTED: 'Yêu cầu hủy đơn',
};

// List all orders
async function listOrders() {
    try {
        const [orders] = await pool.query(
            `SELECT o.order_number, o.status, o.customer_name, o.total_amount, o.order_date, o.updated_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
       FROM orders o 
       ORDER BY o.created_at DESC 
       LIMIT 20`
        );

        if (orders.length === 0) {
            console.log('\n⚠️  Chưa có đơn hàng nào.');
            return;
        }

        console.log('\n📋 DANH SÁCH ĐƠN HÀNG');
        console.log('═'.repeat(100));
        console.log(
            'Mã đơn hàng'.padEnd(22) + ' | ' +
            'Trạng thái'.padEnd(18) + ' | ' +
            'Tên KH'.padEnd(15) + ' | ' +
            'Tổng tiền'.padEnd(14) + ' | ' +
            'SP' + ' | ' +
            'Ngày đặt'
        );
        console.log('─'.repeat(100));

        orders.forEach(o => {
            const date = o.order_date ? new Date(o.order_date).toLocaleString('vi-VN') : 'N/A';
            const status = STATUS_LABELS[o.status] || o.status;
            const amount = Number(o.total_amount).toLocaleString('vi-VN') + 'đ';
            console.log(
                o.order_number.padEnd(22) + ' | ' +
                status.padEnd(18) + ' | ' +
                (o.customer_name || 'N/A').padEnd(15) + ' | ' +
                amount.padEnd(14) + ' | ' +
                String(o.item_count).padEnd(2) + ' | ' +
                date
            );
        });

        console.log('═'.repeat(100));
        console.log(`Tổng: ${orders.length} đơn hàng\n`);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

// Update order status
async function updateStatus(orderNumber, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) {
        console.error(`\n❌ Trạng thái không hợp lệ: "${newStatus}"`);
        console.log(`\n📌 Các trạng thái hợp lệ:`);
        VALID_STATUSES.forEach(s => console.log(`   ${s.padEnd(18)} → ${STATUS_LABELS[s]}`));
        return;
    }

    try {
        // Get current order
        const [orders] = await pool.query(
            'SELECT order_number, status, customer_name, total_amount FROM orders WHERE order_number = ?',
            [orderNumber]
        );

        if (orders.length === 0) {
            console.error(`\n❌ Không tìm thấy đơn hàng: ${orderNumber}`);
            console.log('💡 Chạy "node test-order.js list" để xem danh sách đơn hàng.\n');
            return;
        }

        const order = orders[0];
        const oldLabel = STATUS_LABELS[order.status] || order.status;
        const newLabel = STATUS_LABELS[newStatus] || newStatus;

        console.log(`\n📦 Đơn hàng: ${order.order_number}`);
        console.log(`   Khách hàng: ${order.customer_name}`);
        console.log(`   Tổng tiền: ${Number(order.total_amount).toLocaleString('vi-VN')}đ`);
        console.log(`   ${order.status} (${oldLabel}) → ${newStatus} (${newLabel})`);

        // Update
        const [result] = await pool.query(
            'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_number = ?',
            [newStatus, orderNumber]
        );

        if (result.affectedRows > 0) {
            console.log(`\n✅ Cập nhật thành công! Trạng thái mới: ${newStatus} (${newLabel})`);

            // 🔔 BỔ SUNG LOGIC THÔNG BÁO VÀ ĐIỂM THƯỞNG (Giống như OrderController)
            try {
                const fullOrder = await Order.findById(orderNumber);
                if (fullOrder && fullOrder.userId) {
                    const userId = fullOrder.userId;

                    // 1. Nếu giao hàng thành công -> Cộng điểm thưởng
                    if (newStatus === 'DELIVERED') {
                        const pointsEarned = Math.floor(parseFloat(fullOrder.totalAmount) / 1000);
                        if (pointsEarned > 0) {
                            await LoyaltyPoints.addPoints(
                                pool, userId, pointsEarned,
                                'EARN_PURCHASE', 'Tặng điểm mua hàng (Test Script)', fullOrder.numericId
                            );
                            console.log(`   🎁 Đã tặng ${pointsEarned} điểm thưởng cho khách hàng.`);
                        }

                        // Cập nhật delivered_at
                        await pool.query('UPDATE orders SET delivered_at = NOW() WHERE order_number = ?', [orderNumber]);
                    }

                    // 2. Tạo bản ghi thông báo trong Database
                    const labels = {
                        CONFIRMED: 'Đơn hàng đã được xác nhận',
                        PREPARING: 'Shop đang chuẩn bị hàng',
                        SHIPPING: 'Đơn hàng đang được giao',
                        DELIVERED: 'Đơn hàng đã giao thành công',
                        CANCELLED: 'Đơn hàng đã bị hủy',
                    };
                    const label = labels[newStatus];
                    if (label) {
                        await Notification.create({
                            userId: userId,
                            type: `ORDER_${newStatus}`,
                            title: label,
                            body: `Đơn hàng ${orderNumber} - ${label.toLowerCase()}.`,
                            data: { orderId: orderNumber, status: newStatus },
                        });
                        console.log(`   🔔 Đã lưu thông báo vào Database cho khách hàng.`);
                    }
                }
            } catch (err) {
                console.error('   ⚠️  Lỗi khi tạo thông báo/điểm:', err.message);
            }
            console.log('');
        } else {
            console.log(`\n❌ Cập nhật thất bại.\n`);
        }
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    }
}

// Show help
function showHelp() {
    console.log(`
🛠️  Script Test Trạng Thái Đơn Hàng
═══════════════════════════════════════

Cách dùng:
  node test-order.js list                          → Xem danh sách đơn hàng
  node test-order.js update <ORDER_ID> <STATUS>    → Cập nhật trạng thái

Ví dụ:
  node test-order.js update ORD1772895130057 PREPARING
  node test-order.js update ORD1772895130057 SHIPPING
  node test-order.js update ORD1772895130057 DELIVERED

Luồng trạng thái đơn hàng:
  NEW → CONFIRMED → PREPARING → SHIPPING → DELIVERED
                  ↘ CANCELLED
            PREPARING → CANCEL_REQUESTED

Các trạng thái:`);
    VALID_STATUSES.forEach(s => console.log(`  ${s.padEnd(18)} → ${STATUS_LABELS[s]}`));
    console.log('');
}

// Main
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'list':
            await listOrders();
            break;
        case 'update':
            if (args.length < 3) {
                console.error('\n❌ Thiếu tham số. Cách dùng: node test-order.js update <ORDER_ID> <STATUS>');
                break;
            }
            await updateStatus(args[1], args[2].toUpperCase());
            break;
        default:
            showHelp();
            break;
    }

    await pool.end();
    process.exit(0);
}

main();
