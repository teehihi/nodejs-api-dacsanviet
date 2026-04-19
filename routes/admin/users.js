const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const userAdminController = require('../../controllers/admin/userAdminController');

// All routes require ADMIN role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// GET /api/admin/users - Get all users
router.get('/', userAdminController.getAllUsers);

// GET /api/admin/users/stats - Get user statistics
router.get('/stats', userAdminController.getUserStats);

// GET /api/admin/users/:id - Get user detail
router.get('/:id', userAdminController.getUserDetail);

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/:id/role', userAdminController.updateUserRole);

// POST /api/admin/users/:id/ban - Ban user
router.post('/:id/ban', userAdminController.banUser);

// POST /api/admin/users/:id/unban - Unban user
router.post('/:id/unban', userAdminController.unbanUser);

module.exports = router;
