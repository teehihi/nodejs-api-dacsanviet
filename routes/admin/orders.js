const express = require('express');
const router = express.Router();
const adminOrderController = require('../../controllers/admin/adminOrderController');

// GET /api/admin/orders - Tất cả đơn hàng
router.get('/', adminOrderController.getAllOrders);


// PATCH /api/admin/orders/:orderId/status - Cập nhật trạng thái
router.patch('/:orderId/status', adminOrderController.updateOrderStatus);

module.exports = router;
