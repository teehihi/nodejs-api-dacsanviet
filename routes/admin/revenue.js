const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const revenueController = require('../../controllers/admin/revenueController');

// All routes require ADMIN role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// GET /api/admin/revenue/dashboard - Get unified dashboard data
router.get('/dashboard', revenueController.getDashboardData);

// GET /api/admin/revenue/overview - Get revenue overview
router.get('/overview', revenueController.getRevenueOverview);

// GET /api/admin/revenue/by-category - Get revenue by category
router.get('/by-category', revenueController.getRevenueByCategory);

// GET /api/admin/revenue/by-payment-method - Get revenue by payment method
router.get('/by-payment-method', revenueController.getRevenueByPaymentMethod);

// GET /api/admin/revenue/profit - Get profit analysis
router.get('/profit', revenueController.getProfitAnalysis);

// GET /api/admin/revenue/customer-lifetime-value - Get customer lifetime value
router.get('/customer-lifetime-value', revenueController.getCustomerLifetimeValue);

module.exports = router;
