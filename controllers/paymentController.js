const { createPaymentUrl, verifyReturnUrl } = require('../services/vnpayService');
const { pool } = require('../config/database');

// Tạo URL thanh toán VNPAY cho đơn hàng đã tạo
exports.createVNPayUrl = async (req, res) => {
  try {
    const { orderId, amount, orderInfo } = req.body;
    const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!orderId || !amount) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đơn hàng' });
    }

    const paymentUrl = createPaymentUrl({
      orderId,
      amount,
      orderInfo: orderInfo || `Thanh toan don hang ${orderId}`,
      ipAddr: ipAddr.split(',')[0].trim(),
    });

    res.json({ success: true, data: { paymentUrl } });
  } catch (error) {
    console.error('VNPAY create URL error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo URL thanh toán' });
  }
};

// IPN - VNPAY gọi về để cập nhật trạng thái (server-to-server)
exports.vnpayIPN = async (req, res) => {
  try {
    const vnpParams = req.query;
    const isValid = verifyReturnUrl(vnpParams);

    if (!isValid) {
      return res.json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const orderId = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode;
    const transactionNo = vnpParams.vnp_TransactionNo;

    // Tìm đơn hàng
    const [orders] = await pool.query(
      'SELECT id, status FROM orders WHERE order_number = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    const order = orders[0];

    if (order.status === 'CONFIRMED' || order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      return res.json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (responseCode === '00') {
      // Thanh toán thành công
      await pool.query(
        `UPDATE orders SET payment_status = 'PAID', payment_transaction_id = ?, status = 'CONFIRMED', updated_at = NOW() WHERE id = ?`,
        [transactionNo, order.id]
      );
      console.log(`✅ VNPAY payment success for order ${orderId}, txn: ${transactionNo}`);
    } else {
      // Thanh toán thất bại
      await pool.query(
        `UPDATE orders SET payment_status = 'FAILED', updated_at = NOW() WHERE id = ?`,
        [order.id]
      );
      console.log(`❌ VNPAY payment failed for order ${orderId}, code: ${responseCode}`);
    }

    res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) {
    console.error('VNPAY IPN error:', error);
    res.json({ RspCode: '99', Message: 'Unknown error' });
  }
};

// Return URL - user được redirect về sau khi thanh toán
exports.vnpayReturn = async (req, res) => {
  try {
    const vnpParams = req.query;
    const isValid = verifyReturnUrl(vnpParams);
    const responseCode = vnpParams.vnp_ResponseCode;
    const orderId = vnpParams.vnp_TxnRef;

    if (isValid && responseCode === '00') {
      // Redirect về app với deep link
      res.redirect(`dacsanviet://payment/success?orderId=${orderId}`);
    } else {
      res.redirect(`dacsanviet://payment/failed?orderId=${orderId}&code=${responseCode}`);
    }
  } catch (error) {
    res.redirect(`dacsanviet://payment/failed?error=unknown`);
  }
};

// ── ZaloPay ──
const zalopayService = require('../services/zalopayService');

exports.createZaloPayOrder = async (req, res) => {
  try {
    const { orderId, amount, description } = req.body;
    // orderId ở đây là mã chuỗi (vd: ORD123...)
    if (!orderId || !amount) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đơn hàng' });
    }
    const result = await zalopayService.createOrder({ orderId, amount, description });
    if (result.return_code === 1) {
      // SỬA LỖI: Đảm bảo orderId được truyền vào là string
      console.log(`[ZaloPay] Saving appTransId ${result.appTransId} for order ${orderId}`);
      await pool.query(
        "UPDATE orders SET payment_transaction_id = ? WHERE order_number = ?",
        [result.appTransId, String(orderId)]
      );
      res.json({ success: true, data: { zpTransToken: result.zp_trans_token, appTransId: result.appTransId, orderUrl: result.order_url } });
    } else {
      res.json({ success: false, message: result.return_message });
    }
  } catch (error) {
    console.error('ZaloPay create order error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi tạo đơn ZaloPay: ' + error.message });
  }
};

exports.checkZaloPayStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`[ZaloPay] Checking status for order_number: ${orderId}`);
    
    // Tìm appTransId dựa trên order_number
    const [rows] = await pool.query("SELECT payment_transaction_id FROM orders WHERE order_number = ?", [String(orderId)]);
    
    if (rows.length === 0 || !rows[0].payment_transaction_id) {
      return res.json({ success: false, message: 'Không tìm thấy mã giao dịch ZaloPay' });
    }
    
    const appTransId = rows[0].payment_transaction_id;
    const result = await zalopayService.queryOrder(appTransId);
    console.log('[ZaloPay] Query result:', JSON.stringify(result));
    
    if (result.return_code === 1) {
      // GIỮ TRẠNG THÁI LÀ PENDING (NEW) ĐỂ ADMIN XÁC NHẬN THỦ CÔNG
      await pool.query(
        "UPDATE orders SET payment_status = 'COMPLETED', status = 'PENDING', payment_method = 'ZALOPAY', updated_at = NOW() WHERE order_number = ?",
        [String(orderId)]
      );
      console.log(`[ZaloPay] Order ${orderId} marked as COMPLETED!`);
      return res.json({ success: true, isPaid: true, message: 'Đã thanh toán thành công' });
    } else {
      return res.json({ success: true, isPaid: false, message: result.return_message || 'Chưa thanh toán' });
    }
  } catch (error) {
    console.error('Check ZaloPay status error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi kiểm tra trạng thái: ' + error.message });
  }
};

exports.zalopayCallback = async (req, res) => {
  try {
    const { data, mac } = req.body;
    const isValid = zalopayService.verifyCallback(data, mac);
    if (!isValid) {
      return res.json({ return_code: -1, return_message: 'Invalid mac' });
    }
    
    const callbackData = JSON.parse(data);
    const appTransId = callbackData.app_trans_id;
    const parts = appTransId.split('_');
    const orderIdFromCallback = parts[1];

    console.log(`[ZaloPay Callback] Success for order: ${orderIdFromCallback}`);

    await pool.query(
      "UPDATE orders SET payment_status = 'COMPLETED', status = 'PENDING', payment_method = 'ZALOPAY', updated_at = NOW() WHERE order_number = ?",
      [String(orderIdFromCallback)]
    );
    
    res.json({ return_code: 1, return_message: 'success' });
  } catch (error) {
    console.error('ZaloPay callback error:', error.message);
    res.json({ return_code: 0, return_message: error.message });
  }
};
