const rateLimit = require('express-rate-limit');

// Rate limiter chung cho tất cả requests
const generalLimiter = rateLimit({
  windowMs: 0.5 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 requests mỗi IP trong 15 phút
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Quá nhiều yêu cầu từ IP này. Vui lòng thử lại sau 15 phút.',
      retryAfter: Math.ceil(req.rateLimit.resetTime - Date.now() / 1000)
    });
  }
});

// Rate limiter nghiêm ngặt cho authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Giới hạn 5 requests mỗi IP trong 15 phút
  skipSuccessfulRequests: false, // Đếm cả requests thành công
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(req.rateLimit.resetTime);
    const minutesLeft = Math.ceil((resetTime - Date.now()) / 60000);

    res.status(429).json({
      success: false,
      message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${minutesLeft} phút.`,
      retryAfter: minutesLeft
    });
  }
});

// Rate limiter cho OTP endpoints (rất nghiêm ngặt)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 3, // Giới hạn 3 requests mỗi IP trong 15 phút
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu gửi OTP. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(req.rateLimit.resetTime);
    const minutesLeft = Math.ceil((resetTime - Date.now()) / 60000);

    res.status(429).json({
      success: false,
      message: `Bạn đã gửi quá nhiều yêu cầu OTP. Vui lòng thử lại sau ${minutesLeft} phút.`,
      retryAfter: minutesLeft,
      resetTime: resetTime.toISOString()
    });
  }
});

// Rate limiter cho login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Giới hạn 10 attempts trong 15 phút
  skipSuccessfulRequests: true, // Chỉ đếm failed login attempts
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(req.rateLimit.resetTime);
    const minutesLeft = Math.ceil((resetTime - Date.now()) / 60000);

    res.status(429).json({
      success: false,
      message: `Quá nhiều lần đăng nhập thất bại. Tài khoản tạm thời bị khóa ${minutesLeft} phút.`,
      retryAfter: minutesLeft,
      resetTime: resetTime.toISOString()
    });
  }
});

// Rate limiter cho password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // Giới hạn 3 requests mỗi IP trong 1 giờ
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 1 giờ.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(req.rateLimit.resetTime);
    const minutesLeft = Math.ceil((resetTime - Date.now()) / 60000);

    res.status(429).json({
      success: false,
      message: `Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau ${minutesLeft} phút.`,
      retryAfter: minutesLeft,
      resetTime: resetTime.toISOString()
    });
  }
});

// Rate limiter nhẹ cho các API đọc dữ liệu
const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // Giới hạn 30 requests mỗi IP trong 1 phút
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng chậm lại.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  loginLimiter,
  passwordResetLimiter,
  readLimiter
};
