const express = require('express');
const router = express.Router();
const Session = require('../models/Session');

// GET /api/sessions - Lấy tất cả sessions (admin only)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const sessions = await Session.findAll(parseInt(limit), parseInt(offset));
    const stats = await Session.getStats();
    
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách sessions thành công',
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.totalSessions
        },
        stats
      }
    });
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách sessions'
    });
  }
});

// GET /api/sessions/stats - Lấy thống kê sessions
router.get('/stats', async (req, res) => {
  try {
    const stats = await Session.getStats();
    
    res.status(200).json({
      success: true,
      message: 'Lấy thống kê sessions thành công',
      data: {
        stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê sessions'
    });
  }
});

// GET /api/sessions/ip/:ip - Lấy sessions theo IP
router.get('/ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const { limit = 20 } = req.query;
    
    const sessions = await Session.findByIpAddress(ip, parseInt(limit));
    
    res.status(200).json({
      success: true,
      message: `Tìm thấy ${sessions.length} sessions từ IP ${ip}`,
      data: {
        sessions,
        total: sessions.length,
        ipAddress: ip
      }
    });
  } catch (error) {
    console.error('Get sessions by IP error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy sessions theo IP'
    });
  }
});

// DELETE /api/sessions/cleanup - Xóa sessions hết hạn
router.delete('/cleanup', async (req, res) => {
  try {
    const deletedCount = await Session.cleanupExpiredSessions();
    
    res.status(200).json({
      success: true,
      message: `Đã xóa ${deletedCount} sessions hết hạn`,
      data: {
        deletedSessions: deletedCount
      }
    });
  } catch (error) {
    console.error('Cleanup sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa sessions hết hạn'
    });
  }
});

// DELETE /api/sessions/:sessionId - Xóa session cụ thể
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const invalidated = await Session.invalidateSession(sessionId);
    
    if (!invalidated) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy session'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Xóa session thành công',
      data: {
        sessionId: sessionId
      }
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa session'
    });
  }
});

module.exports = router;