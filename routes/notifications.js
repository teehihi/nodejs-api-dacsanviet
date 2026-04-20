const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Notification = require('../models/Notification');

// GET /api/notifications - lấy danh sách
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.findByUserId(req.user.id, req.user.role);
    const unreadCount = await Notification.getUnreadCount(req.user.id, req.user.role);
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id, req.user.role);
    res.json({ success: true, data: { count } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await Notification.markRead(req.params.id, req.user.id, req.user.role);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id, req.user.role);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/notifications/internal - dùng cho Admin Dashboard (internal key)
router.post('/internal', async (req, res) => {
  const key = req.headers['x-internal-key'];
  if (key !== 'dacsanviet_internal_2024') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const { userId, type, title, body, data } = req.body;
    const { notifyUser } = require('../socket/socketManager');
    const notif = await Notification.create({ userId, type, title, body, data });
    notifyUser(userId, 'notification', notif);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
