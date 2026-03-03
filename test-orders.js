const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// Test credentials
const testUser = {
  emailOrUsername: 'admin@dacsanviet.com',
  password: 'admin123'
};

let authToken = '';

// Login first
async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, testUser);
    if (response.data.success) {
      authToken = response.data.data.tokens.accessToken;
      console.log('✅ Login successful');
      return true;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

// Test create order
async function testCreateOrder() {
  try {
    const orderData = {
      items: [
        {
          productId: 1,
          productName: 'Bánh đậu xanh Hải Dương',
          productImage: '/uploads/products/banh-dau-xanh.jpg',
          price: 120000,
          quantity: 2
        },
        {
          productId: 2,
          productName: 'Nem chua Thanh Hóa',
          productImage: '/uploads/products/nem-chua.jpg',
          price: 85000,
          quantity: 1
        }
      ],
      shippingAddress: {
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0123456789',
        address: '123 Đường ABC',
        ward: 'Phường 1',
        district: 'Quận 1',
        city: 'TP. Hồ Chí Minh',
        note: 'Giao giờ hành chính'
      },
      paymentMethod: 'COD'
    };

    const response = await axios.post(`${API_URL}/orders`, orderData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ Create order successful');
      console.log('Order ID:', response.data.data.order.id);
      return response.data.data.order.id;
    }
  } catch (error) {
    console.error('❌ Create order failed:', error.response?.data || error.message);
    return null;
  }
}

// Test get user orders
async function testGetOrders() {
  try {
    const response = await axios.get(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ Get orders successful');
      console.log('Total orders:', response.data.data.length);
      return response.data.data;
    }
  } catch (error) {
    console.error('❌ Get orders failed:', error.response?.data || error.message);
    return [];
  }
}

// Test get order by ID
async function testGetOrderById(orderId) {
  try {
    const response = await axios.get(`${API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ Get order by ID successful');
      console.log('Order status:', response.data.data.order.status);
      return response.data.data.order;
    }
  } catch (error) {
    console.error('❌ Get order by ID failed:', error.response?.data || error.message);
    return null;
  }
}

// Test cancel order
async function testCancelOrder(orderId) {
  try {
    const response = await axios.post(`${API_URL}/orders/${orderId}/cancel`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ Cancel order successful');
      console.log('New status:', response.data.data.order.status);
      return true;
    }
  } catch (error) {
    console.error('❌ Cancel order failed:', error.response?.data || error.message);
    return false;
  }
}

// Test get order stats
async function testGetOrderStats() {
  try {
    const response = await axios.get(`${API_URL}/orders/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.success) {
      console.log('✅ Get order stats successful');
      console.log('Stats:', response.data.data.stats);
      return response.data.data.stats;
    }
  } catch (error) {
    console.error('❌ Get order stats failed:', error.response?.data || error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Order API Tests...\n');

  // Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without login');
    return;
  }

  console.log('\n--- Test 1: Create Order ---');
  const orderId = await testCreateOrder();

  console.log('\n--- Test 2: Get User Orders ---');
  await testGetOrders();

  if (orderId) {
    console.log('\n--- Test 3: Get Order by ID ---');
    await testGetOrderById(orderId);

    console.log('\n--- Test 4: Cancel Order ---');
    await testCancelOrder(orderId);

    console.log('\n--- Test 5: Verify Cancellation ---');
    await testGetOrderById(orderId);
  }

  console.log('\n--- Test 6: Get Order Stats ---');
  await testGetOrderStats();

  console.log('\n✅ All tests completed!');
}

runTests();
