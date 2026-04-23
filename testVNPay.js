const vnpayService = require('./services/vnpayService');
async function test() {
  try {
    const res = vnpayService.createPaymentUrl({ orderId: 'test1234', amount: 50000, orderInfo: 'test' });
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
test();
