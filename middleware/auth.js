const JWTService = require('../utils/jwt');
const User = require('../models/User');

// Middleware xác thực JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp'
      });
    }

    // Verify token
    const decoded = JWTService.verifyToken(token);
    
    // Kiểm tra user còn tồn tại và active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc tài khoản đã bị khóa'
      });
    }

    // Thêm thông tin user vào request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive
    };

    next();
  } catch (error) {
    console.error('JWT authentication error:', error);
    
    if (error.message === 'Invalid token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực token'
    });
  }
};

// Middleware kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực'
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập'
    });
  }

  next();
};

// Middleware kiểm tra quyền staff hoặc admin
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực'
    });
  }

  if (!['ADMIN', 'STAFF'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập'
    });
  }

  next();
};

// Middleware kiểm tra user chỉ có thể truy cập dữ liệu của chính mình
const requireOwnershipOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực'
    });
  }

  const targetUserId = parseInt(req.params.id || req.params.userId);
  
  // Admin có thể truy cập tất cả
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // User chỉ có thể truy cập dữ liệu của chính mình
  if (req.user.id !== targetUserId) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập dữ liệu này'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireStaffOrAdmin,
  requireOwnershipOrAdmin
};