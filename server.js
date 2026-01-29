const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database và routes
const { initializeDatabase, getDatabaseInfo } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const profileRoutes = require('./routes/profile');
const User = require('./models/User');
const Session = require('./models/Session');
const OTP = require('./models/OTP');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Trust proxy for getting real IP
app.set('trust proxy', true);

// Serve static files (avatars)
app.use('/uploads', express.static('public/uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/profile', profileRoutes);

// Root endpoint
app.get('/', async (req, res) => {
  try {
    const userStats = await User.getStats();
    const sessionStats = await Session.getStats();
    const otpStats = await OTP.getStats();
    
    res.json({
      message: 'Group API Server - JWT + OTP Version',
      version: '3.0.0',
      features: ['JWT Authentication', 'OTP Verification', 'Email Service', 'Session Management'],
      database: {
        type: 'MySQL',
        status: 'Connected',
        stats: {
          users: userStats,
          sessions: sessionStats,
          otps: otpStats
        }
      },
      endpoints: {
        auth: 'GET /api/auth',
        users: 'GET /api/users',
        sessions: 'GET /api/sessions',
        register: 'POST /api/auth/register',
        registerWithOTP: 'POST /api/auth/send-registration-otp + POST /api/auth/verify-registration-otp',
        login: 'POST /api/auth/login',
        forgotPassword: 'POST /api/auth/send-password-reset-otp + POST /api/auth/reset-password-otp',
        database: 'GET /api/database'
      },
      time: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Group API Server - JWT + OTP Version',
      version: '3.0.0',
      database: {
        type: 'MySQL',
        status: 'Error',
        error: error.message
      },
      time: new Date().toISOString()
    });
  }
});

// Database info endpoint
app.get('/api/database', async (req, res) => {
  try {
    const userStats = await User.getStats();
    const sessionStats = await Session.getStats();
    const otpStats = await OTP.getStats();

    res.json({
      success: true,
      message: 'MySQL Database Information',
      data: {
        type: 'MySQL',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        stats: {
          users: userStats,
          sessions: sessionStats,
          otps: otpStats
        },
        tables: ['users', 'api_sessions', 'otp_codes'],
        features: [
          'User authentication',
          'JWT token management',
          'OTP verification',
          'Email service',
          'Session management',
          'Password hashing',
          'Soft delete',
          'Search functionality',
          'Statistics tracking'
        ]
      }
    });
  } catch (error) {
    console.error('Database info error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin database',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await User.getStats();
    
    res.json({
      success: true,
      message: 'API is healthy',
      data: {
        status: 'OK',
        database: 'Connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API health check failed',
      data: {
        status: 'ERROR',
        database: 'Disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /api/auth',
      'GET /api/users',
      'GET /api/sessions',
      'GET /api/database',
      'GET /api/health'
    ]
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('Starting Group API Server (MySQL Version)...');
    
    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      process.exit(1);
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}`);
      console.log(`Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`User endpoints: http://localhost:${PORT}/api/users`);
      console.log(`Session endpoints: http://localhost:${PORT}/api/sessions`);
      console.log(`Database info: http://localhost:${PORT}/api/database`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log('');
      console.log('Default Admin Account:');
      console.log('Email: admin@dacsanviet.com');
      console.log('Password: admin123');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server gracefully...');
  process.exit(0);
});

startServer();