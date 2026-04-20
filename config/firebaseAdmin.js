const admin = require('firebase-admin');
const path = require('path');

try {
  const serviceAccount = require('../serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('✅ Firebase Admin SDK initialized');
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK not initialized: Missing serviceAccountKey.json');
}

/**
 * Gửi thông báo Push Notification đến một hoặc nhiều thiết bị
 * @param {string|string[]} tokens - FCM token của thiết bị nhận
 * @param {Object} notification - Nội dung thông báo { title, body }
 * @param {Object} data - Dữ liệu đính kèm (optional)
 */
const sendPushNotification = async (tokens, notification, data = {}) => {
  if (!admin.apps.length) return;

  const message = {
    notification,
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };

  try {
    if (Array.isArray(tokens)) {
      if (tokens.length === 0) return;
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...message
      });
      console.log(`Successfully sent ${response.successCount} push notifications`);
    } else {
      if (!tokens) return;
      const response = await admin.messaging().send({
        token: tokens,
        ...message
      });
      console.log('Successfully sent push notification:', response);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * Gửi thông báo đến tất cả admin
 * @param {Object} notification - { title, body }
 * @param {Object} data - Dữ liệu đính kèm
 */
const notifyAdminsPush = async (notification, data = {}) => {
  try {
    const User = require('../models/User');
    // Lấy tất cả token của các user có role ADMIN và có fcm_token
    // (Bạn cần thêm cột fcm_token vào bảng users trong DB)
    const adminTokens = await User.getAdminFcmTokens();
    
    if (adminTokens && adminTokens.length > 0) {
      await sendPushNotification(adminTokens, notification, data);
    }
  } catch (error) {
    console.error('Error in notifyAdminsPush:', error);
  }
};

module.exports = { admin, sendPushNotification, notifyAdminsPush };
