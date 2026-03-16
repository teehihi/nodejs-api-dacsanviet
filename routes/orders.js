const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.productId').isInt().withMessage('Product ID must be an integer'),
  body('items.*.productName').notEmpty().withMessage('Product name is required'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('shippingAddress.fullName').notEmpty().withMessage('Full name is required'),
  body('shippingAddress.phoneNumber')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),
  body('shippingAddress.address').notEmpty().withMessage('Address is required'),
  body('shippingAddress.ward').notEmpty().withMessage('Ward is required'),
  body('shippingAddress.district').notEmpty().withMessage('District is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('paymentMethod')
    .optional()
    .isIn(['COD', 'E_WALLET', 'BANK_TRANSFER'])
    .withMessage('Invalid payment method'),
];

// Create new order
router.post('/', authenticateToken, createOrderValidation, orderController.createOrder);

// Get user's orders
router.get('/', authenticateToken, orderController.getUserOrders);

// Get order statistics
router.get('/stats', authenticateToken, orderController.getOrderStats);

// Get spending statistics (cash flow)
router.get('/spending-stats', authenticateToken, async (req, res) => {
  try {
    const Order = require('../models/Order');
    const stats = await Order.getSpendingStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Get order by ID
router.get('/:orderId', authenticateToken, orderController.getOrderById);

// Cancel order
router.post('/:orderId/cancel', authenticateToken, orderController.cancelOrder);

// Get ALL orders (Admin only)
router.get(
  '/all',
  authenticateToken,
  requireRole(['ADMIN', 'STAFF']),
  orderController.getAllOrders
);

// Update order status (Admin only)
router.patch(
  '/:orderId/status',
  authenticateToken,
  requireRole(['ADMIN', 'STAFF']),
  orderController.updateOrderStatus
);

// DEV ONLY: Update order status without admin role
router.put(
  '/:orderId/dev-status',
  authenticateToken,
  orderController.updateOrderStatus
);

module.exports = router;
