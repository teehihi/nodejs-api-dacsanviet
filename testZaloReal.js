const zalopayService = require('./services/zalopayService');
async function test() {
  try {
    const res = await zalopayService.createOrder({ orderId: 'test' + Date.now(), amount: 50000, description: 'test' });
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
test();
