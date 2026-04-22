const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Protect ALL admin routes
router.use(authenticateToken, requireRole(['ADMIN']));

// Use sub-routers
router.use('/orders', require('./orders'));
router.use('/users', require('./users'));
router.use('/products', require('./products'));
router.use('/coupons', require('./coupons'));
router.use('/revenue', require('./revenue'));
router.use('/ai', require('./ai'));

module.exports = router;
