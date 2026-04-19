const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  checkSession,
  logoutAll,
  sendRegistrationOTP,
  verifyRegistrationOTP,
  sendPasswordResetOTP,
  resetPasswordWithOTP
} = require('../controllers/authController');

// Import validators
const {
  registrationValidation,
  sendRegistrationOTPValidation,
  verifyRegistrationOTPValidation,
  loginValidation,
  sendPasswordResetOTPValidation,
  resetPasswordWithOTPValidation,
  sessionValidation
} = require('../middleware/validators');

// Import rate limiters
const {
  authLimiter,
  otpLimiter,
  loginLimiter,
  passwordResetLimiter,
  readLimiter
} = require('../middleware/rateLimiter');

// POST /api/auth/register - Đăng ký tài khoản (legacy - không dùng OTP)
router.post('/register', authLimiter, registrationValidation, register);

// POST /api/auth/send-registration-otp - Gửi OTP cho đăng ký
router.post('/send-registration-otp', otpLimiter, sendRegistrationOTPValidation, sendRegistrationOTP);

// POST /api/auth/verify-registration-otp - Xác thực OTP và hoàn tất đăng ký
router.post('/verify-registration-otp', authLimiter, verifyRegistrationOTPValidation, verifyRegistrationOTP);

// POST /api/auth/send-password-reset-otp - Gửi OTP cho reset password
router.post('/send-password-reset-otp', passwordResetLimiter, sendPasswordResetOTPValidation, sendPasswordResetOTP);

// POST /api/auth/reset-password-otp - Reset password với OTP
router.post('/reset-password-otp', passwordResetLimiter, resetPasswordWithOTPValidation, resetPasswordWithOTP);

// POST /api/auth/login - Đăng nhập với JWT
router.post('/login', loginLimiter, loginValidation, login);

// POST /api/auth/logout - Đăng xuất
router.post('/logout', logout);

// POST /api/auth/logout-all - Đăng xuất tất cả thiết bị
router.post('/logout-all', sessionValidation, logoutAll);

// POST /api/auth/check-session - Kiểm tra phiên đăng nhập
router.post('/check-session', readLimiter, sessionValidation, checkSession);

// GET /api/auth - Thông tin về auth endpoints
router.get('/', (req, res) => {
  res.json({
    message: 'Authentication API Endpoints - JWT + OTP Version',
    database: 'MySQL',
    features: ['JWT Authentication', 'OTP Verification', 'Email Service'],
    endpoints: {
      register: {
        method: 'POST',
        path: '/api/auth/register',
        description: 'Đăng ký tài khoản mới (legacy - không dùng OTP)',
        body: {
          username: 'string (required)',
          email: 'string (required)',
          password: 'string (required, min 6 chars)',
          fullName: 'string (required)',
          phoneNumber: 'string (optional)',
          role: 'string (optional, default: USER, accepted: USER, STAFF, ADMIN)'
        }
      },
      sendRegistrationOTP: {
        method: 'POST',
        path: '/api/auth/send-registration-otp',
        description: 'Gửi OTP cho đăng ký tài khoản (validate email & username trước khi gửi)',
        body: {
          email: 'string (required)',
          username: 'string (required, min 3 chars)',
          fullName: 'string (optional)'
        }
      },
      verifyRegistrationOTP: {
        method: 'POST',
        path: '/api/auth/verify-registration-otp',
        description: 'Xác thực OTP và hoàn tất đăng ký',
        body: {
          email: 'string (required)',
          otpCode: 'string (required)',
          username: 'string (required)',
          password: 'string (required, min 6 chars)',
          fullName: 'string (required)',
          phoneNumber: 'string (optional)',
          role: 'string (optional, default: USER, accepted: USER, STAFF, ADMIN)'
        }
      },
      sendPasswordResetOTP: {
        method: 'POST',
        path: '/api/auth/send-password-reset-otp',
        description: 'Gửi OTP cho reset password',
        body: {
          email: 'string (required)'
        }
      },
      resetPasswordWithOTP: {
        method: 'POST',
        path: '/api/auth/reset-password-otp',
        description: 'Reset password với OTP',
        body: {
          email: 'string (required)',
          otpCode: 'string (required)',
          newPassword: 'string (required, min 6 chars)'
        }
      },
      login: {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Đăng nhập tài khoản với JWT',
        body: {
          emailOrUsername: 'string (required) - Email hoặc Username',
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