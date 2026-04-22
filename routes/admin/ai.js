const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/admin/aiController');

// Tất cả các route AI đã được bảo vệ bởi router cha trong admin/index.js
router.post('/chat', aiController.chatWithAI);

module.exports = router;
