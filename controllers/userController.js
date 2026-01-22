const User = require('../models/User');
const Session = require('../models/Session');

// Lấy danh sách tất cả users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const users = await User.findAll(parseInt(limit), parseInt(offset));
    const stats = await User.getStats();
    
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách người dùng thành công',
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.totalUsers
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách người dùng'
    });
  }
};

// Lấy thông tin user theo ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Loại bỏ password khỏi response
    const userResponse = User.sanitizeUser(user);

    res.status(200).json({
      success: true,
      message: 'Lấy thông tin người dùng thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin người dùng'
    });
  }
};

// Cập nhật thông tin user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Cập nhật thông tin
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

    const updatedUser = await User.updateById(id, updateData);

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật thông tin'
      });
    }

    // Loại bỏ password khỏi response
    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thông tin'
    });
  }
};

// Xóa user (soft delete)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Không cho phép xóa admin cuối cùng
    if (user.role === 'ADMIN') {
      const stats = await User.getStats();
      if (stats.adminUsers <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa admin cuối cùng'
        });
      }
    }

    const deleted = await User.deleteById(id);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Không thể xóa người dùng'
      });
    }

    // Vô hiệu hóa tất cả sessions của user
    await Session.invalidateUserSessions(id);

    res.status(200).json({
      success: true,
      message: 'Xóa người dùng thành công',
      data: {
        deletedUserId: id
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa người dùng'
    });
  }
};

// Lấy thống kê users
const getUserStats = async (req, res) => {
  try {
    const userStats = await User.getStats();
    const sessionStats = await Session.getStats();

    res.status(200).json({
      success: true,
      message: 'Lấy thống kê thành công',
      data: {
        users: userStats,
        sessions: sessionStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê'
    });
  }
};

// Tìm kiếm users
const searchUsers = async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự'
      });
    }

    const searchResults = await User.search(q.trim(), parseInt(limit));

    res.status(200).json({
      success: true,
      message: `Tìm thấy ${searchResults.length} kết quả`,
      data: {
        users: searchResults,
        total: searchResults.length,
        query: q.trim(),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tìm kiếm'
    });
  }
};

// Lấy sessions của user
const getUserSessions = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    const sessions = await Session.findByUserId(id);

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách phiên đăng nhập thành công',
      data: {
        user: User.sanitizeUser(user),
        sessions,
        total: sessions.length
      }
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách phiên đăng nhập'
    });
  }
};

// Kích hoạt/vô hiệu hóa user
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Không cho phép vô hiệu hóa admin cuối cùng
    if (user.role === 'ADMIN' && user.isActive) {
      const stats = await User.getStats();
      if (stats.adminUsers <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Không thể vô hiệu hóa admin cuối cùng'
        });
      }
    }

    const updatedUser = await User.updateById(id, {
      isActive: !user.isActive
    });

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật trạng thái người dùng'
      });
    }

    // Nếu vô hiệu hóa user, xóa tất cả sessions
    if (!updatedUser.isActive) {
      await Session.invalidateUserSessions(id);
    }

    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: `${updatedUser.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} người dùng thành công`,
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật trạng thái người dùng'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  searchUsers,
  getUserSessions,
  toggleUserStatus
};