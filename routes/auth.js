const express = require('express');
const router = express.Router();
const { register, login, logout, checkSession, logoutAll } = require('../controllers/authController');

// POST /api/auth/register - Đăng ký tài khoản
router.post('/register', register);

// POST /api/auth/login - Đăng nhập
router.post('/login', login);

// POST /api/auth/logout - Đăng xuất
router.post('/logout', logout);

// POST /api/auth/logout-all - Đăng xuất tất cả thiết bị
router.post('/logout-all', logoutAll);

// POST /api/auth/check-session - Kiểm tra phiên đăng nhập
router.post('/check-session', checkSession);

// GET /api/auth - Thông tin về auth endpoints
router.get('/', (req, res) => {
  res.json({
    message: 'Authentication API Endpoints - MySQL Version',
    database: 'MySQL',
    endpoints: {
      register: {
        method: 'POST',
        path: '/api/auth/register',
        description: 'Đăng ký tài khoản mới',
        body: {
          username: 'string (required)',
          email: 'string (required)',
          password: 'string (required, min 6 chars)',
          fullName: 'string (required)',
          phoneNumber: 'string (optional)'
        }
      },
      login: {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Đăng nhập tài khoản',
        body: {
          email: 'string (required)',
          password: 'string (required)'
        }
      },
      logout: {
        method: 'POST',
        path: '/api/auth/logout',
        description: 'Đăng xuất tài khoản',
        body: {
          sessionId: 'string (optional)'
        }
      },
      logoutAll: {
        method: 'POST',
        path: '/api/auth/logout-all',
        description: 'Đăng xuất tất cả thiết bị',
        body: {
          sessionId: 'string (required)'
        }
      },
      checkSession: {
        method: 'POST',
        path: '/api/auth/check-session',
        description: 'Kiểm tra phiên đăng nhập',
        body: {
          sessionId: 'string (required)'
        }
      }
    }
  });
});

module.exports = router;