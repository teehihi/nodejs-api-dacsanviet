const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Test data
const testUser = {
  email: 'test.otp@example.com',
  username: 'testotp',
  password: 'password123',
  fullName: 'Test OTP User',
  phoneNumber: '0123456789'
};

let otpCode = '';

// Helper function để delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test functions
async function testSendRegistrationOTP() {
  console.log('\n=== Test Send Registration OTP ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/send-registration-otp`, {
      email: testUser.email,
      fullName: testUser.fullName
    });
    
    console.log('✅ Send Registration OTP Success:', response.data);
    
    // Simulate getting OTP from email (in real app, user would enter this)
    console.log('\n📧 Check your email for OTP code');
    console.log('For testing, please enter the OTP code manually in the next test');
    
    return true;
  } catch (error) {
    console.error('❌ Send Registration OTP Error:', error.response?.data || error.message);
    return false;
  }
}

async function testVerifyRegistrationOTP(otp) {
  console.log('\n=== Test Verify Registration OTP ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/verify-registration-otp`, {
      email: testUser.email,
      otpCode: otp,
      username: testUser.username,
      password: testUser.password,
      fullName: testUser.fullName,
      phoneNumber: testUser.phoneNumber
    });
    
    console.log('✅ Verify Registration OTP Success:', response.data);
    return response.data.data.tokens;
  } catch (error) {
    console.error('❌ Verify Registration OTP Error:', error.response?.data || error.message);
    return null;
  }
}

async function testLogin() {
  console.log('\n=== Test Login with JWT ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      emailOrUsername: testUser.email,
      password: testUser.password
    });
    
    console.log('✅ Login Success:', response.data);
    return response.data.data.tokens;
  } catch (error) {
    console.error('❌ Login Error:', error.response?.data || error.message);
    return null;
  }
}

async function testSendPasswordResetOTP() {
  console.log('\n=== Test Send Password Reset OTP ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/send-password-reset-otp`, {
      email: testUser.email
    });
    
    console.log('✅ Send Password Reset OTP Success:', response.data);
    console.log('\n📧 Check your email for password reset OTP code');
    return true;
  } catch (error) {
    console.error('❌ Send Password Reset OTP Error:', error.response?.data || error.message);
    return false;
  }
}

async function testResetPasswordWithOTP(otp) {
  console.log('\n=== Test Reset Password with OTP ===');
  try {
    const newPassword = 'newpassword123';
    const response = await axios.post(`${API_BASE_URL}/auth/reset-password-otp`, {
      email: testUser.email,
      otpCode: otp,
      newPassword: newPassword
    });
    
    console.log('✅ Reset Password Success:', response.data);
    
    // Update test password for future tests
    testUser.password = newPassword;
    return true;
  } catch (error) {
    console.error('❌ Reset Password Error:', error.response?.data || error.message);
    return false;
  }
}

async function testProtectedEndpoint(token) {
  console.log('\n=== Test Protected Endpoint ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Protected Endpoint Success:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Protected Endpoint Error:', error.response?.data || error.message);
    return false;
  }
}

async function testAPIHealth() {
  console.log('\n=== Test API Health ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/../`);
    console.log('✅ API Health:', response.data);
    return true;
  } catch (error) {
    console.error('❌ API Health Error:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting OTP API Tests...');
  console.log('API Base URL:', API_BASE_URL);
  
  // Test API health first
  await testAPIHealth();
  
  // Test registration flow with OTP
  console.log('\n📝 Testing Registration Flow with OTP...');
  const otpSent = await testSendRegistrationOTP();
  
  if (otpSent) {
    console.log('\n⏳ Waiting for OTP input...');
    console.log('Please check your email and enter the OTP code when prompted');
    
    // In a real test, you would get the OTP from email
    // For now, we'll simulate with a placeholder
    console.log('\n⚠️  Manual step required: Enter OTP from email');
    console.log('Example: node test-otp-api.js verify-registration 123456');
  }
  
  // Test password reset flow
  console.log('\n🔐 Testing Password Reset Flow...');
  await testSendPasswordResetOTP();
  console.log('\n⚠️  Manual step required: Enter OTP from email');
  console.log('Example: node test-otp-api.js reset-password 123456');
  
  console.log('\n✅ Basic tests completed!');
  console.log('📧 Check your email for OTP codes to complete the flows');
}

// Handle command line arguments for manual OTP testing
const args = process.argv.slice(2);
if (args.length >= 2) {
  const command = args[0];
  const otp = args[1];
  
  if (command === 'verify-registration') {
    testVerifyRegistrationOTP(otp).then(tokens => {
      if (tokens) {
        console.log('\n🎉 Registration completed successfully!');
        console.log('Access Token:', tokens.accessToken);
        
        // Test login after registration
        setTimeout(() => testLogin(), 1000);
      }
    });
  } else if (command === 'reset-password') {
    testResetPasswordWithOTP(otp).then(success => {
      if (success) {
        console.log('\n🎉 Password reset completed successfully!');
        
        // Test login with new password
        setTimeout(() => testLogin(), 1000);
      }
    });
  } else {
    console.log('❌ Unknown command. Use: verify-registration <otp> or reset-password <otp>');
  }
} else {
  // Run main tests
  runTests().catch(error => {
    console.error('❌ Test runner error:', error);
  });
}

// Export for use in other files
module.exports = {
  testSendRegistrationOTP,
  testVerifyRegistrationOTP,
  testLogin,
  testSendPasswordResetOTP,
  testResetPasswordWithOTP,
  testProtectedEndpoint,
  testAPIHealth
};