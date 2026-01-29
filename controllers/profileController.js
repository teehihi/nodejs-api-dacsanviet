const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

    // Generate OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('🔍 Generated Email OTP:', otpCode, 'for new email:', newEmail);

    // Send OTP email to CURRENT email (not new email) for security
    const emailResult = await emailService.sendEmailUpdateOTP(user.email, otpCode, user.fullName, newEmail);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP'
      });
    }

    // Create JWT token chứa OTP info
    const otpToken = jwt.sign({
      userId,
      currentEmail: user.email,
      newEmail,
      otpCode,
      purpose: 'email_update',
      exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
    }, process.env.JWT_SECRET);

    res.status(200).json({
      success: true,
      message: 'Mã OTP đã được gửi đến email hiện tại của bạn',
      data: {
        email: user.email, // Return current email, not new email
        otpToken,
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
    const { newEmail, otpCode, otpToken } = req.body;

    // Validation
    if (!newEmail || !otpCode || !otpToken) {
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

    // Verify OTP token
    let tokenData;
    try {
      tokenData = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn'
      });
    }

    console.log('🔍 Debug Email OTP verification:');
    console.log('- Token Data:', tokenData);
    console.log('- Input OTP:', otpCode);
    console.log('- Token OTP:', tokenData.otpCode);
    console.log('- User ID match:', tokenData.userId === userId);
    console.log('- Email match:', tokenData.newEmail === newEmail);
    console.log('- Purpose:', tokenData.purpose);

    // Verify OTP code and data
    if (tokenData.otpCode !== otpCode || 
        tokenData.userId !== userId || 
        tokenData.newEmail !== newEmail ||
        tokenData.purpose !== 'email_update') {
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

    const userResponse = User.sanitizeUser(updatedUser);

    console.log('✅ Email updated successfully for user:', tokenData.currentEmail, '→', newEmail);

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

    // Generate OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('🔍 Generated Phone OTP:', otpCode, 'for user:', user.email);

    // Send OTP to user's email (fallback since SMS is not implemented)
    const emailResult = await emailService.sendPhoneUpdateOTP(user.email, otpCode, user.fullName, newPhone);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP'
      });
    }

    // Create JWT token chứa OTP info
    const otpToken = jwt.sign({
      userId,
      email: user.email,
      otpCode,
      purpose: 'phone_update',
      newPhone,
      exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
    }, process.env.JWT_SECRET);

    res.status(200).json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      data: {
        email: user.email,
        otpToken,
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
    const { newPhone, otpCode, otpToken } = req.body;

    // Validation
    if (!newPhone || !otpCode || !otpToken) {
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

    // Verify OTP token
    let tokenData;
    try {
      tokenData = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn'
      });
    }

    console.log('🔍 Debug Phone OTP verification:');
    console.log('- Token Data:', tokenData);
    console.log('- Input OTP:', otpCode);
    console.log('- Token OTP:', tokenData.otpCode);
    console.log('- User ID match:', tokenData.userId === userId);
    console.log('- Email match:', tokenData.email === user.email);
    console.log('- Phone match:', tokenData.newPhone === newPhone);
    console.log('- Purpose:', tokenData.purpose);

    // Verify OTP code and data
    if (tokenData.otpCode !== otpCode || 
        tokenData.userId !== userId || 
        tokenData.email !== user.email ||
        tokenData.newPhone !== newPhone ||
        tokenData.purpose !== 'phone_update') {
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

    const userResponse = User.sanitizeUser(updatedUser);

    console.log('✅ Phone updated successfully for user:', user.email);

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

// Send OTP for password change
const sendPasswordChangeOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword } = req.body;

    // Validation
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại'
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

    // Generate OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    
    console.log('🔍 Generated OTP:', otpCode, 'for user:', user.email);

    // Send OTP email
    const emailResult = await emailService.sendPasswordChangeOTP(user.email, otpCode, user.fullName);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP'
      });
    }

    // Create JWT token chứa OTP info (expires in 5 minutes)
    const otpToken = jwt.sign({
      userId,
      email: user.email,
      otpCode,
      purpose: 'password_change',
      exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
    }, process.env.JWT_SECRET);

    // Store OTP token in memory cache (optional - for rate limiting)
    global.otpCache = global.otpCache || new Map();
    const cacheKey = `${user.email}_password_change`;
    global.otpCache.set(cacheKey, {
      attempts: (global.otpCache.get(cacheKey)?.attempts || 0) + 1,
      lastSent: Date.now()
    });

    res.status(200).json({
      success: true,
      message: 'Mã OTP đã được gửi đến email của bạn',
      data: {
        email: user.email,
        otpToken, // Frontend sẽ gửi lại token này khi verify
        expiresIn: '5 phút'
      }
    });
  } catch (error) {
    console.error('Send password change OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi OTP'
    });
  }
};

// Verify OTP and change password
const verifyPasswordChangeOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, otpCode, otpToken } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !otpCode || !otpToken) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin'
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

    // Verify OTP token
    let tokenData;
    try {
      tokenData = jwt.verify(otpToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn'
      });
    }

    console.log('🔍 Debug OTP verification:');
    console.log('- Token Data:', tokenData);
    console.log('- Input OTP:', otpCode);
    console.log('- Token OTP:', tokenData.otpCode);
    console.log('- User ID match:', tokenData.userId === userId);
    console.log('- Email match:', tokenData.email === user.email);
    console.log('- Purpose:', tokenData.purpose);

    // Verify OTP code and user
    if (tokenData.otpCode !== otpCode || 
        tokenData.userId !== userId || 
        tokenData.email !== user.email ||
        tokenData.purpose !== 'password_change') {
      return res.status(403).json({
        success: false,
        message: 'Mã OTP không hợp lệ'
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

    console.log('✅ Password changed successfully for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (error) {
    console.error('Verify password change OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đổi mật khẩu'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  sendPasswordChangeOTP,
  verifyPasswordChangeOTP,
  sendEmailUpdateOTP,
  verifyEmailUpdate,
  sendPhoneUpdateOTP,
  verifyPhoneUpdate
};
