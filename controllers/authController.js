const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const OTP = require('../models/OTP');
const JWTService = require('../utils/jwt');
const emailService = require('../services/emailService');
const { validateEmail, validatePassword } = require('../utils/validation');

// Register - Đăng ký tài khoản mới
const register = async (req, res) => {
  try {
    const { username, email, password, fullName, phoneNumber } = req.body;

    // Validation
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc (username, email, password, fullName)'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Validate password strength
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Kiểm tra email đã tồn tại
    if (await User.emailExists(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    // Kiểm tra username đã tồn tại
    if (await User.usernameExists(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username đã được sử dụng'
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      phoneNumber: phoneNumber || null
    });

    if (!newUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo tài khoản'
      });
    }

    // Trả về thông tin user (không bao gồm password)
    const userResponse = User.sanitizeUser(newUser);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng ký tài khoản'
    });
  }
};

// Login - Đăng nhập với JWT
const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Validation
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email/username và mật khẩu'
      });
    }

    // Tìm user theo email hoặc username
    let user = null;
    
    // Kiểm tra xem input có phải là email không (có chứa @)
    if (emailOrUsername.includes('@')) {
      user = await User.findByEmail(emailOrUsername);
    } else {
      user = await User.findByUsername(emailOrUsername);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email/Username hoặc mật khẩu không chính xác'
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email/Username hoặc mật khẩu không chính xác'
      });
    }

    // Tạo JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Tạo session để tracking (optional)
    const sessionId = `session_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    const sessionData = {
      userId: user.id,
      sessionId: sessionId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      expiresAt: expiresAt
    };

    await Session.create(sessionData);

    // Trả về thông tin user và tokens
    const userResponse = User.sanitizeUser(user);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: userResponse,
        tokens,
        session: {
          sessionId: sessionId,
          expiresAt: expiresAt
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập'
    });
  }
};

// Logout - Đăng xuất
const logout = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (sessionId) {
      await Session.invalidateSession(sessionId);
    }

    res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng xuất'
    });
  }
};

// Check session - Kiểm tra phiên đăng nhập
const checkSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID không hợp lệ'
      });
    }

    const session = await Session.findBySessionId(sessionId);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'
      });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không hợp lệ'
      });
    }

    const userResponse = User.sanitizeUser(user);

    res.status(200).json({
      success: true,
      message: 'Phiên đăng nhập hợp lệ',
      data: {
        user: userResponse,
        session: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Check session error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra phiên đăng nhập'
    });
  }
};

// Logout all sessions - Đăng xuất tất cả thiết bị
const logoutAll = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID không hợp lệ'
      });
    }

    const session = await Session.findBySessionId(sessionId);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ'
      });
    }

    const invalidatedCount = await Session.invalidateUserSessions(session.userId);

    res.status(200).json({
      success: true,
      message: `Đã đăng xuất ${invalidatedCount} phiên đăng nhập`,
      data: {
        invalidatedSessions: invalidatedCount
      }
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng xuất tất cả thiết bị'
    });
  }
};

// Send OTP for registration
const sendRegistrationOTP = async (req, res) => {
  try {
    const { email, fullName } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Kiểm tra email đã tồn tại
    if (await User.emailExists(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    // Kiểm tra rate limit
    const canSendOTP = await OTP.checkRateLimit(email, 'registration', 300000, 3); // 5 phút, tối đa 3 lần
    if (!canSendOTP) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 5 phút'
      });
    }

    // Vô hiệu hóa các OTP cũ
    await OTP.invalidateOldOTPs(email, 'registration');

    // Tạo OTP mới
    const otpCode = OTP.generateOTPCode(6);
    const expiresAt = OTP.calculateExpiryTime(5); // 5 phút

    const otpData = {
      email,
      otpCode,
      purpose: 'registration',
      expiresAt
    };

    const otp = await OTP.create(otpData);
    if (!otp) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo mã OTP'
      });
    }

    // Gửi email OTP
    const emailResult = await emailService.sendRegistrationOTP(email, otpCode, fullName);
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
        email,
        expiresAt,
        expiresIn: '5 phút'
      }
    });

  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi OTP'
    });
  }
};

// Verify OTP and complete registration
const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otpCode, username, password, fullName, phoneNumber } = req.body;

    // Validation
    if (!email || !otpCode || !username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Validate password strength
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Kiểm tra OTP hợp lệ
    const validOTP = await OTP.findValidOTP(email, otpCode, 'registration');
    if (!validOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn'
      });
    }

    // Kiểm tra email đã tồn tại (double check)
    if (await User.emailExists(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }

    // Kiểm tra username đã tồn tại
    if (await User.usernameExists(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username đã được sử dụng'
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      fullName,
      phoneNumber: phoneNumber || null
    });

    if (!newUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo tài khoản'
      });
    }

    // Đánh dấu OTP đã sử dụng
    await OTP.markAsUsed(validOTP.id);

    // Tạo JWT tokens
    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role
    };

    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Gửi email chào mừng
    await emailService.sendWelcomeEmail(email, fullName, username);

    // Trả về thông tin user và tokens
    const userResponse = User.sanitizeUser(newUser);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        user: userResponse,
        tokens
      }
    });

  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực OTP'
    });
  }
};

// Send OTP for password reset
const sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Kiểm tra email có tồn tại không
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email không tồn tại trong hệ thống'
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Kiểm tra rate limit
    const canSendOTP = await OTP.checkRateLimit(email, 'password_reset', 300000, 3); // 5 phút, tối đa 3 lần
    if (!canSendOTP) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 5 phút'
      });
    }

    // Vô hiệu hóa các OTP cũ
    await OTP.invalidateOldOTPs(email, 'password_reset');

    // Tạo OTP mới
    const otpCode = OTP.generateOTPCode(6);
    const expiresAt = OTP.calculateExpiryTime(5); // 5 phút

    const otpData = {
      email,
      otpCode,
      purpose: 'password_reset',
      expiresAt
    };

    const otp = await OTP.create(otpData);
    if (!otp) {
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo mã OTP'
      });
    }

    // Gửi email OTP
    const emailResult = await emailService.sendPasswordResetOTP(email, otpCode, user.fullName);
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
        email,
        expiresAt,
        expiresIn: '5 phút'
      }
    });

  } catch (error) {
    console.error('Send password reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi OTP'
    });
  }
};

// Reset password with OTP
const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otpCode, newPassword } = req.body;

    // Validation
    if (!email || !otpCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin'
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    // Validate password strength
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Kiểm tra OTP hợp lệ
    const validOTP = await OTP.findValidOTP(email, otpCode, 'password_reset');
    if (!validOTP) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không hợp lệ hoặc đã hết hạn'
      });
    }

    // Tìm user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email không tồn tại trong hệ thống'
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Hash password mới
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Cập nhật password
    const updatedUser = await User.updateById(user.id, { password: hashedPassword });
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật mật khẩu'
      });
    }

    // Đánh dấu OTP đã sử dụng
    await OTP.markAsUsed(validOTP.id);

    // Vô hiệu hóa tất cả sessions của user (buộc đăng nhập lại)
    await Session.invalidateUserSessions(user.id);

    res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại'
    });

  } catch (error) {
    console.error('Reset password with OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đặt lại mật khẩu'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  checkSession,
  logoutAll,
  sendRegistrationOTP,
  verifyRegistrationOTP,
  sendPasswordResetOTP,
  resetPasswordWithOTP
};