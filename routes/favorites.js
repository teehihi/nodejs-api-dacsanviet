const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

router.get('/:productId/status', optionalAuth, favoriteController.checkStatus);

// Protected routes
router.use(authenticateToken);
router.get('/', favoriteController.getFavorites);
router.post('/:productId', favoriteController.toggleFavorite);

module.exports = router;
