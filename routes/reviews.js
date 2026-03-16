const express    = require('express');
const router     = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl       = require('../controllers/reviewController');

// ── Public routes ──────────────────────────────────────────────────────────────
router.get('/product/:productId', ctrl.getProductReviews);

// ── Protected routes ───────────────────────────────────────────────────────────
router.use(authenticateToken);

router.post('/',                              ctrl.createReview);
router.get('/my',                             ctrl.getMyReviews);
router.get('/my-rewards',                     ctrl.getMyRewards);
router.get('/check',                          ctrl.checkReviewed);
router.get('/eligibility/:productId',         ctrl.checkEligibility);
router.get('/order-status/:orderId',          ctrl.getOrderReviewStatus);
router.get('/pending-for-order/:orderId',     ctrl.getPendingReviewsForOrder);

module.exports = router;
