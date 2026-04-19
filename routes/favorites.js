const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken } = require('../middleware/auth');

// Optional auth middleware
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dacsanviet_secret_key_2024');
            req.user = decoded;
        } catch (error) {
            // Ignore token error for optional auth
        }
    }
    next();
};

router.get('/:productId/status', optionalAuth, favoriteController.checkStatus);

// Protected routes
router.use(authenticateToken);
router.get('/', favoriteController.getFavorites);
router.post('/:productId', favoriteController.toggleFavorite);

module.exports = router;
