const crypto = require('crypto');
const querystring = require('querystring');

const VNPAY_CONFIG = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE || 'W0X7EGVF',
  vnp_HashSecret: process.env.VNPAY_HASH_SECRET || 'RQPBQVBCEEKNZXJQPVNDTCFTWDUQBAAN',
  vnp_Url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'https://dacsanviet.site/api/payment/vnpay/return',
  vnp_IpnUrl: process.env.VNPAY_IPN_URL || 'https://dacsanviet.site/api/payment/vnpay/ipn',
};

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = obj[key];
  }
  return sorted;
}

function createPaymentUrl({ orderId, amount, orderInfo, ipAddr = '127.0.0.1', locale = 'vn' }) {
  // VNPAY yêu cầu múi giờ GMT+7
  const date = new Date();
  // Offset 7 hours
  const gmt7Date = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const createDate = gmt7Date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  
  const expireDateObj = new Date(gmt7Date.getTime() + 15 * 60 * 1000);
  const expireDate = expireDateObj.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY_CONFIG.vnp_TmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(orderId),
    vnp_OrderInfo: orderInfo || `Thanh toan don hang ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount) * 100, // VNPAY tính theo đơn vị nhỏ nhất (x100)
    vnp_ReturnUrl: VNPAY_CONFIG.vnp_ReturnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };

  const sorted = sortObject(vnpParams);
  const signData = querystring.stringify(sorted, '&', '=', { encode: false });
  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  sorted.vnp_SecureHash = signed;
  return `${VNPAY_CONFIG.vnp_Url}?${querystring.stringify(sorted, '&', '=', { encode: false })}`;
}

function verifyReturnUrl(vnpParams) {
  const secureHash = vnpParams.vnp_SecureHash;
  const params = { ...vnpParams };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sorted = sortObject(params);
  const signData = querystring.stringify(sorted, '&', '=', { encode: false });
  const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  return signed === secureHash;
}

module.exports = { createPaymentUrl, verifyReturnUrl, VNPAY_CONFIG };
