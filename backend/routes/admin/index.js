const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');

// Protect ALL admin routes
router.use(authenticateToken, requireRole(['ADMIN']));

// Use sub-routers
router.use('/orders', require('./orders'));
router.use('/users', require('../users'));

module.exports = router;
