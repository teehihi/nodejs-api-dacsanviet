const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database và routes
const { initializeDatabase, pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const profileRoutes = require('./routes/profile');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const favoriteRoutes = require('./routes/favorites');
const couponRoutes = require('./routes/coupons');
const loyaltyPointsRoutes = require('./routes/loyaltyPoints');
const User = require('./models/User');
const Session = require('./models/Session');
const OTP = require('./models/OTP');

// Import rate limiter
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Trust proxy for getting real IP
app.set('trust proxy', 1);

// Serve static files
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/loyalty-points', loyaltyPointsRoutes);

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
        products: 'GET /api/products',
        orders: 'GET /api/orders',
        reviews: 'GET /api/reviews',
        favorites: 'GET /api/favorites',
        coupons: 'GET /api/coupons',
        loyaltyPoints: 'GET /api/loyalty-points',
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

// ⏰ Auto-confirm orders after 30 minutes (theo yêu cầu đề bài)
const autoConfirmOrders = async () => {
  try {
    const [result] = await pool.execute(`
      UPDATE orders 
      SET status = 'CONFIRMED', updated_at = NOW()
      WHERE status = 'NEW' 
        AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= 30
    `);
    if (result.affectedRows > 0) {
      console.log(`⏰ Auto-confirmed ${result.affectedRows} order(s) after 30 minutes`);
    }
  } catch (error) {
    console.error('❌ Auto-confirm error:', error.message);
  }
};

// Chạy auto-confirm mỗi 5 phút
setInterval(autoConfirmOrders, 5 * 60 * 1000);
console.log('⏰ Auto-confirm scheduler started (runs every 5 minutes)');

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