const { body, validationResult } = require('express-validator');

// Middleware để xử lý kết quả validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format errors theo chuẩn: { resource, field, message }
    const formattedErrors = errors.array().map(error => ({
      resource: error.path.includes('email') || error.path.includes('username') || error.path.includes('password') ? 'user' :
                error.path.includes('otp') ? 'otp' : 'unknown',
      field: error.path,
      message: error.msg
    }));

    return res.status(400).json({
      success: false,
      errors: formattedErrors
    });
  }

  next();
};

// Validation rules cho registration
const registrationValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  body('username')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập tên đăng nhập')
    .isLength({ min: 3 }).withMessage('Tên đăng nhập phải có ít nhất 3 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'),

  body('password')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  body('fullName')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập họ và tên')
    .isLength({ min: 2 }).withMessage('Họ và tên phải có ít nhất 2 ký tự'),

  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),

  body('role')
    .optional()
    .isIn(['USER', 'STAFF', 'ADMIN']).withMessage('Quyền (role) không hợp lệ. Chỉ chấp nhận: USER, STAFF, ADMIN'),

  handleValidationErrors
];

// Validation rules cho send registration OTP
const sendRegistrationOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  body('username')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập tên đăng nhập')
    .isLength({ min: 3 }).withMessage('Tên đăng nhập phải có ít nhất 3 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'),

  body('fullName')
    .optional()
    .trim(),

  handleValidationErrors
];

// Validation rules cho verify registration OTP
const verifyRegistrationOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  body('otpCode')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập mã OTP')
    .isLength({ min: 6, max: 6 }).withMessage('Mã OTP phải có 6 chữ số')
    .isNumeric().withMessage('Mã OTP chỉ được chứa số'),

  body('username')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập tên đăng nhập')
    .isLength({ min: 3 }).withMessage('Tên đăng nhập phải có ít nhất 3 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'),

  body('password')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  body('fullName')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập họ và tên')
    .isLength({ min: 2 }).withMessage('Họ và tên phải có ít nhất 2 ký tự'),

  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),

  body('role')
    .optional()
    .isIn(['USER', 'STAFF', 'ADMIN']).withMessage('Quyền (role) không hợp lệ. Chỉ chấp nhận: USER, STAFF, ADMIN'),

  handleValidationErrors
];

// Validation rules cho login
const loginValidation = [
  body(['emailOrUsername', 'email', 'username'])
    .custom((value, { req }) => {
      // Ít nhất 1 trong 3 field phải có giá trị
      if (!req.body.emailOrUsername && !req.body.email && !req.body.username) {
        throw new Error('Vui lòng nhập email hoặc tên đăng nhập');
      }
      return true;
    }),

  body('password')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu'),

  handleValidationErrors
];

// Validation rules cho send password reset OTP
const sendPasswordResetOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  handleValidationErrors
];

// Validation rules cho reset password with OTP
const resetPasswordWithOTPValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),

  body('otpCode')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập mã OTP')
    .isLength({ min: 6, max: 6 }).withMessage('Mã OTP phải có 6 chữ số')
    .isNumeric().withMessage('Mã OTP chỉ được chứa số'),

  body('newPassword')
    .notEmpty().withMessage('Vui lòng nhập mật khẩu mới')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  handleValidationErrors
];

// Validation rules cho session
const sessionValidation = [
  body('sessionId')
    .trim()
    .notEmpty().withMessage('Session ID không hợp lệ'),

  handleValidationErrors
];

module.exports = {
  registrationValidation,
  sendRegistrationOTPValidation,
  verifyRegistrationOTPValidation,
  loginValidation,
  sendPasswordResetOTPValidation,
  resetPasswordWithOTPValidation,
  sessionValidation,
  handleValidationErrors
};
