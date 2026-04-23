const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// Tạo URL thanh toán VNPAY (cần auth)
router.post('/vnpay/create-url', authenticateToken, paymentController.createVNPayUrl);

// IPN callback từ VNPAY (không cần auth - VNPAY gọi trực tiếp)
router.get('/vnpay/ipn', paymentController.vnpayIPN);

// Return URL sau khi thanh toán
router.get('/vnpay/return', paymentController.vnpayReturn);

// ZaloPay
router.post('/zalopay/create-order', authenticateToken, paymentController.createZaloPayOrder);
router.post('/zalopay/callback', paymentController.zalopayCallback);
router.get('/zalopay/status/:orderId', authenticateToken, paymentController.checkZaloPayStatus);

module.exports = router;
