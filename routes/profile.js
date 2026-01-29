const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  sendEmailUpdateOTP,
  verifyEmailUpdate,
  sendPhoneUpdateOTP,
  verifyPhoneUpdate
} = require('../controllers/profileController');

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/avatars/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Chỉ chấp nhận file ảnh'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/profile - Get current user profile
router.get('/', getProfile);

// PATCH /api/profile - Update basic profile info
router.patch('/', updateProfile);

// POST /api/profile/avatar - Upload avatar
router.post('/avatar', upload.single('avatar'), uploadAvatar);

// POST /api/profile/change-password - Change password
router.post('/change-password', changePassword);

// POST /api/profile/email/send-otp - Send OTP for email update
router.post('/email/send-otp', sendEmailUpdateOTP);

// POST /api/profile/email/verify-otp - Verify OTP and update email
router.post('/email/verify-otp', verifyEmailUpdate);

// POST /api/profile/phone/send-otp - Send OTP for phone update
router.post('/phone/send-otp', sendPhoneUpdateOTP);

// POST /api/profile/phone/verify-otp - Verify OTP and update phone
router.post('/phone/verify-otp', verifyPhoneUpdate);

// GET /api/profile - Info about profile endpoints
router.get('/info', (req, res) => {
  res.json({
    message: 'Profile Management API Endpoints',
    endpoints: {
      getProfile: {
        method: 'GET',
        path: '/api/profile',
        description: 'Lấy thông tin profile của user hiện tại',
        auth: 'Required (JWT)'
      },
      updateProfile: {
        method: 'PATCH',
        path: '/api/profile',
        description: 'Cập nhật thông tin cơ bản (fullName, phoneNumber)',
        auth: 'Required (JWT)',
        body: {
          fullName: 'string (required)',
          phoneNumber: 'string (optional)'
        }
      },
      uploadAvatar: {
        method: 'POST',
        path: '/api/profile/avatar',
        description: 'Upload avatar',
        auth: 'Required (JWT)',
        contentType: 'multipart/form-data',
        body: {
          avatar: 'file (image, max 5MB)'
        }
      },
      changePassword: {
        method: 'POST',
        path: '/api/profile/change-password',
        description: 'Đổi mật khẩu',
        auth: 'Required (JWT)',
        body: {
          currentPassword: 'string (required)',
          newPassword: 'string (required, min 6 chars)'
        }
      },
      sendEmailUpdateOTP: {
        method: 'POST',
        path: '/api/profile/email/send-otp',
        description: 'Gửi OTP để cập nhật email',
        auth: 'Required (JWT)',
        body: {
          newEmail: 'string (required)'
        }
      },
      verifyEmailUpdate: {
        method: 'POST',
        path: '/api/profile/email/verify-otp',
        description: 'Xác thực OTP và cập nhật email',
        auth: 'Required (JWT)',
        body: {
          newEmail: 'string (required)',
          otpCode: 'string (required)'
        }
      },
      sendPhoneUpdateOTP: {
        method: 'POST',
        path: '/api/profile/phone/send-otp',
        description: 'Gửi OTP để cập nhật số điện thoại',
        auth: 'Required (JWT)',
        body: {
          newPhone: 'string (required)'
        }
      },
      verifyPhoneUpdate: {
        method: 'POST',
        path: '/api/profile/phone/verify-otp',
        description: 'Xác thực OTP và cập nhật số điện thoại',
        auth: 'Required (JWT)',
        body: {
          newPhone: 'string (required)',
          otpCode: 'string (required)'
        }
      }
    }
  });
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Lỗi khi upload file'
    });
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Lỗi khi upload file'
    });
  }
  
  next();
});

module.exports = router;
