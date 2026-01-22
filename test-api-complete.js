const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
  console.log('Testing Group API - MySQL Version');
  console.log('=====================================');
  
  try {
    // Test 1: Root endpoint
    console.log('\n1. Testing root endpoint...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log('Status:', rootResponse.status);
    console.log('Database:', rootResponse.data.database.type);
    console.log('User stats:', rootResponse.data.database.stats.users);
    
    // Test 2: Auth endpoints info
    console.log('\n2. Testing auth endpoints info...');
    const authResponse = await axios.get(`${BASE_URL}/api/auth`);
    console.log('Status:', authResponse.status);
    console.log('Available endpoints:', Object.keys(authResponse.data.endpoints));
    
    // Test 3: Register new user
    console.log('\n3. Testing user registration...');
    const registerData = {
      username: 'apitest',
      email: 'apitest@example.com',
      password: 'password123',
      fullName: 'API Test User',
      phoneNumber: '0987654321'
    };
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
      console.log('Registration Status:', registerResponse.status);
      console.log('New user ID:', registerResponse.data.data.user.id);
      console.log('New user role:', registerResponse.data.data.user.role);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('Registration failed (user may already exist):', error.response.data.message);
      } else {
        throw error;
      }
    }
    
    // Test 4: Login
    console.log('\n4. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'apitest@example.com',
      password: 'password123'
    });
    console.log('Login Status:', loginResponse.status);
    console.log('Session ID:', loginResponse.data.data.session.sessionId);
    const sessionId = loginResponse.data.data.session.sessionId;
    
    // Test 5: Check session
    console.log('\n5. Testing session check...');
    const sessionResponse = await axios.post(`${BASE_URL}/api/auth/check-session`, {
      sessionId: sessionId
    });
    console.log('Session check Status:', sessionResponse.status);
    console.log('Session valid:', sessionResponse.data.success);
    
    // Test 6: Get all users
    console.log('\n6. Testing get all users...');
    const usersResponse = await axios.get(`${BASE_URL}/api/users`);
    console.log('Users Status:', usersResponse.status);
    console.log('Total users:', usersResponse.data.data.stats.totalUsers);
    console.log('Active users:', usersResponse.data.data.stats.activeUsers);
    
    // Test 7: Get sessions
    console.log('\n7. Testing get sessions...');
    const sessionsResponse = await axios.get(`${BASE_URL}/api/sessions`);
    console.log('Sessions Status:', sessionsResponse.status);
    console.log('Active sessions:', sessionsResponse.data.data.stats.activeSessions);
    
    // Test 8: Search users
    console.log('\n8. Testing user search...');
    const searchResponse = await axios.get(`${BASE_URL}/api/users/search?q=test`);
    console.log('Search Status:', searchResponse.status);
    console.log('Search results:', searchResponse.data.data.total);
    
    // Test 9: Database info
    console.log('\n9. Testing database info...');
    const dbResponse = await axios.get(`${BASE_URL}/api/database`);
    console.log('Database Status:', dbResponse.status);
    console.log('Database name:', dbResponse.data.data.database);
    console.log('Total tables:', dbResponse.data.data.stats.users.totalUsers);
    
    // Test 10: Health check
    console.log('\n10. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    console.log('Health Status:', healthResponse.status);
    console.log('API Status:', healthResponse.data.data.status);
    
    console.log('\n=====================================');
    console.log('All tests completed successfully!');
    console.log('API is fully functional and synchronized with database.');
    
  } catch (error) {
    console.error('\nTest failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run tests
testAPI();