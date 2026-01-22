const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  searchUsers,
  getUserSessions,
  toggleUserStatus
} = require('../controllers/userController');

// GET /api/users - Lấy danh sách tất cả users (có phân trang)
router.get('/', getAllUsers);

// GET /api/users/search - Tìm kiếm users
router.get('/search', searchUsers);

// GET /api/users/stats - Lấy thống kê users
router.get('/stats', getUserStats);

// GET /api/users/role/:role - Lấy users theo role
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const { limit = 50 } = req.query;
    
    const User = require('../models/User');
    const users = await User.findByRole(role, parseInt(limit));
    
    res.status(200).json({
      success: true,
      message: `Lấy danh sách ${role} thành công`,
      data: {
        users,
        total: users.length,
        role: role
      }
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách theo role'
    });
  }
});

// GET /api/users/:id - Lấy thông tin user theo ID
router.get('/:id', getUserById);

// GET /api/users/:id/sessions - Lấy sessions của user
router.get('/:id/sessions', getUserSessions);

// PUT /api/users/:id - Cập nhật thông tin user
router.put('/:id', updateUser);

// PATCH /api/users/:id/toggle-status - Kích hoạt/vô hiệu hóa user
router.patch('/:id/toggle-status', toggleUserStatus);

// DELETE /api/users/:id - Xóa user (soft delete)
router.delete('/:id', deleteUser);

module.exports = router;