const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes
router.use(authenticateToken);

router.get('/my', couponController.getMyCoupons);
router.post('/validate', couponController.validateCoupon);

module.exports = router;
