const crypto = require('crypto');
const axios = require('axios');
const querystring = require('querystring');

// ZaloPay Sandbox credentials
const ZALOPAY_CONFIG = {
  app_id: process.env.ZALOPAY_APP_ID || '2554',
  key1: process.env.ZALOPAY_KEY1 || 'sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn',
  key2: process.env.ZALOPAY_KEY2 || 'trMrHtvjo6myautxDUiAcYsVtaeQ8nhf',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
};

async function createOrder({ orderId, amount, description }) {
  const dateObj = new Date();
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  
  // ZaloPay yêu cầu mã giao dịch phải là định dạng YYMMDD_xxxxxx và phải DUY NHẤT.
  // Nếu user bấm "Thanh toán lại", orderId vẫn giữ nguyên -> lỗi trùng mã (-68).
  // Giải pháp: Thêm timestamp vào sau orderId để đảm bảo tính duy nhất.
  const uniqueSuffix = Date.now().toString().slice(-6);
  const appTransId = `${yy}${mm}${dd}_${orderId}_${uniqueSuffix}`;
  const embedData = JSON.stringify({ redirecturl: 'dacsanviet://zalopay' });
  const items = JSON.stringify([]);

  const appTime = Date.now();
  const appUser = 'user_' + orderId;

  const data = [
    ZALOPAY_CONFIG.app_id,
    appTransId,
    appUser,
    amount,
    appTime,
    embedData,
    items,
  ].join('|');

  const mac = crypto.createHmac('sha256', ZALOPAY_CONFIG.key1)
    .update(data)
    .digest('hex');

  const params = {
    app_id: ZALOPAY_CONFIG.app_id,
    app_trans_id: appTransId,
    app_user: appUser,
    app_time: appTime,
    amount,
    item: items,
    description,
    embed_data: embedData,
    mac,
    bank_code: '',
    callback_url: process.env.ZALOPAY_CALLBACK_URL || 'http://localhost:3001/api/payment/zalopay/callback',
  };

  const response = await axios.post(ZALOPAY_CONFIG.endpoint, null, { params });
  return { ...response.data, appTransId };
}

async function queryOrder(appTransId) {
  const postData = {
    app_id: ZALOPAY_CONFIG.app_id,
    app_trans_id: appTransId,
  };

  const data = postData.app_id + '|' + postData.app_trans_id + '|' + ZALOPAY_CONFIG.key1;
  postData.mac = crypto.createHmac('sha256', ZALOPAY_CONFIG.key1).update(data).digest('hex');

  const postConfig = {
    method: 'post',
    url: 'https://sb-openapi.zalopay.vn/v2/query',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: querystring.stringify(postData)
  };

  try {
    const response = await axios(postConfig);
    return response.data;
  } catch (error) {
    console.error('ZaloPay Query Error:', error);
    return { return_code: 0, return_message: 'Query failed' };
  }
}

function verifyCallback(data, mac) {
  const computedMac = crypto.createHmac('sha256', ZALOPAY_CONFIG.key2)
    .update(data)
    .digest('hex');
  return computedMac === mac;
}

module.exports = { createOrder, queryOrder, verifyCallback };
