const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
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

// Login - Đăng nhập (không dùng JWT)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // Tìm user theo email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác'
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
        message: 'Email hoặc mật khẩu không chính xác'
      });
    }

    // Tạo session
    const sessionId = `session_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + (parseInt(process.env.SESSION_TIMEOUT) || 86400000)); // 24 hours
    
    const sessionData = {
      userId: user.id,
      sessionId: sessionId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      expiresAt: expiresAt
    };

    const session = await Session.create(sessionData);

    // Trả về thông tin user (không bao gồm password)
    const userResponse = User.sanitizeUser(user);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: userResponse,
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

module.exports = {
  register,
  login,
  logout,
  checkSession,
  logoutAll
};