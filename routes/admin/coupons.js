const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const couponAdminController = require('../../controllers/admin/couponAdminController');

// All routes require ADMIN or STAFF role
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'STAFF']));

// GET /api/admin/coupons - Get all coupons
router.get('/', couponAdminController.getAllCoupons);

// GET /api/admin/coupons/stats - Get coupon statistics
router.get('/stats', couponAdminController.getCouponStats);

// POST /api/admin/coupons - Create coupon
router.post('/', couponAdminController.createCoupon);

// PUT /api/admin/coupons/:id - Update coupon
router.put('/:id', couponAdminController.updateCoupon);

// DELETE /api/admin/coupons/:id - Delete coupon
router.delete('/:id', couponAdminController.deleteCoupon);

// PATCH /api/admin/coupons/:id/toggle-status - Toggle active status
router.patch('/:id/toggle-status', couponAdminController.toggleCouponStatus);

module.exports = router;
