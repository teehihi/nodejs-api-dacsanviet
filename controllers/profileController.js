const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const emailService = require('../services/emailService');
const { validateEmail, validatePassword } = require('../utils/validation');
const path = require('path');
const fs = require('fs').promises;

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    const userResponse = User.sanitizeUser(user);

    res.status(200).json({
      success: true,
      message: 'Lấy thông tin profile thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin profile'
    });
  }
};

// Update basic profile info (fullName, phoneNumber)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, phoneNumber } = req.body;

    // Validation
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên không được để trống'
      });
    }

    const updateData = {
      fullName: fullName.trim()
    };

    // Phone number is optional
    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    }

    const updatedUser = await User.updateById(userId, updateData);
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật thông tin'
      });
    }

    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thông tin'
    });
  }
};

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ảnh để tải lên'
      });
    }

    // File path relative to public directory
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Get old avatar to delete
    const user = await User.findById(userId);
    const oldAvatarUrl = user?.avatarUrl;

    // Update user avatar URL in database
    const updatedUser = await User.updateById(userId, { avatarUrl });
    if (!updatedUser) {
      // Delete uploaded file if database update fails
      await fs.unlink(req.file.path).catch(err => console.error('Error deleting file:', err));
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật avatar'
      });
    }

    // Delete old avatar file if exists
    if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
      const relativePath = oldAvatarUrl.startsWith('/') ? oldAvatarUrl.substring(1) : oldAvatarUrl;
      const oldAvatarPath = path.join(__dirname, '..', 'public', relativePath);
      console.log('Attempting to delete old avatar:', oldAvatarPath);
      await fs.unlink(oldAvatarPath).catch(err => console.log('Old avatar deletion failed or file not found:', err.message));
    }

    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: 'Cập nhật avatar thành công',
      data: {
        user: userResponse,
        avatarUrl
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(err => console.error('Error deleting file:', err));
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tải lên avatar'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới'
      });
    }

    // Validate new password strength
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
      });
    }

    // Get user with password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác'
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại'
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updatedUser = await User.updateById(userId, { password: hashedPassword });
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật mật khẩu'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đổi mật khẩu'
    });
  }
};

// Send OTP for email update
const sendEmailUpdateOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail } = req.body;

    // Validation
    if (!newEmail) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email mới'
      });
    }

    // Validate email format
    if (!validateEmail(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Check if new email is same as current
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email mới phải khác email hiện tại'
      });
    }

    // Check if new email already exists
    if (await User.emailExists(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng bởi tài khoản khác'
      });
    }

    // Check rate limit
    const canSendOTP = await OTP.checkRateLimit(newEmail, 'email_update', 300000, 3); // 5 minutes, max 3 times
    if (!canSendOTP) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 5 phút'
      });
    }

    // Invalidate old OTPs
    await OTP.invalidateOldOTPs(newEmail, 'email_update');

    // Create new OTP
    const otpCode = OTP.generateOTPCode(6);
    const expiresAt = OTP.calculateExpiryTime(5); // 5 minutes

    const otpData = {
      email: newEmail,
      otpCode,
      purpose: 'email_update',
      expiresAt,
      metadata: JSON.stringify({ userId })
    };

    const otp = await OTP.create(otpData);
    if (!otp) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo mã OTP'
      });
    }

    // Send OTP email
    const emailResult = await emailService.sendEmailUpdateOTP(newEmail, otpCode, user.fullName);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Mã OTP đã được gửi đến email mới của bạn',
      data: {
        email: newEmail,
        expiresAt,
        expiresIn: '5 phút'
      }
    });
  } catch (error) {
    console.error('Send email update OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi OTP'
    });
  }
};

// Verify OTP and update email
const verifyEmailUpdate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail, otpCode } = req.body;

    // Validation
    if (!newEmail || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email mới và mã OTP'
      });
    }

    // Validate email format
    if (!validateEmail(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Verify OTP
    const validOTP = await OTP.findValidOTP(newEmail, otpCode, 'email_update');
    if (!validOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn'
      });
    }

    // Verify OTP belongs to this user
    const otpMetadata = validOTP.metadata ? JSON.parse(validOTP.metadata) : {};
    if (otpMetadata.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Mã OTP không hợp lệ'
      });
    }

    // Check if email already exists (double check)
    if (await User.emailExists(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng bởi tài khoản khác'
      });
    }

    // Update email
    const updatedUser = await User.updateById(userId, { email: newEmail });
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật email'
      });
    }

    // Mark OTP as used
    await OTP.markAsUsed(validOTP.id);

    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: 'Cập nhật email thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Verify email update error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật email'
    });
  }
};

// Send OTP for phone update
const sendPhoneUpdateOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPhone } = req.body;

    // Validation
    if (!newPhone) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập số điện thoại mới'
      });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Check if new phone is same as current
    if (newPhone === user.phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại mới phải khác số điện thoại hiện tại'
      });
    }

    // Check rate limit (use email as identifier since we're sending to email)
    const canSendOTP = await OTP.checkRateLimit(user.email, 'phone_update', 300000, 3);
    if (!canSendOTP) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 5 phút'
      });
    }

    // Invalidate old OTPs
    await OTP.invalidateOldOTPs(user.email, 'phone_update');

    // Create new OTP
    const otpCode = OTP.generateOTPCode(6);
    const expiresAt = OTP.calculateExpiryTime(5); // 5 minutes

    const otpData = {
      email: user.email, // Send to current email
      otpCode,
      purpose: 'phone_update',
      expiresAt,
      metadata: JSON.stringify({ userId, newPhone })
    };

    const otp = await OTP.create(otpData);
    if (!otp) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo mã OTP'
      });
    }

    // Send OTP to user's email (fallback since SMS is not implemented)
    const emailResult = await emailService.sendPhoneUpdateOTP(user.email, otpCode, user.fullName, newPhone);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      data: {
        email: user.email,
        expiresAt,
        expiresIn: '5 phút'
      }
    });
  } catch (error) {
    console.error('Send phone update OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi OTP'
    });
  }
};

// Verify OTP and update phone
const verifyPhoneUpdate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newPhone, otpCode } = req.body;

    // Validation
    if (!newPhone || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập số điện thoại mới và mã OTP'
      });
    }

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Verify OTP
    const validOTP = await OTP.findValidOTP(user.email, otpCode, 'phone_update');
    if (!validOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn'
      });
    }

    // Verify OTP belongs to this user and phone number matches
    const otpMetadata = validOTP.metadata ? JSON.parse(validOTP.metadata) : {};
    if (otpMetadata.userId !== userId || otpMetadata.newPhone !== newPhone) {
      return res.status(403).json({
        success: false,
        message: 'Mã OTP không hợp lệ'
      });
    }

    // Update phone number
    const updatedUser = await User.updateById(userId, { phoneNumber: newPhone });
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật số điện thoại'
      });
    }

    // Mark OTP as used
    await OTP.markAsUsed(validOTP.id);

    const userResponse = User.sanitizeUser(updatedUser);

    res.status(200).json({
      success: true,
      message: 'Cập nhật số điện thoại thành công',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Verify phone update error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật số điện thoại'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  sendEmailUpdateOTP,
  verifyEmailUpdate,
  sendPhoneUpdateOTP,
  verifyPhoneUpdate
};
