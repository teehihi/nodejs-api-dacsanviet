const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', couponController.getLoyaltyPoints);
router.get('/history', couponController.getPointsHistory);

module.exports = router;
