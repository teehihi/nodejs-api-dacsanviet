const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/product/:productId', reviewController.getProductReviews);

// Protected routes
router.use(authenticateToken);
router.post('/', reviewController.createReview);
router.get('/my', reviewController.getMyReviews);

module.exports = router;
