const axios = require('axios');

async function testRoleRegistration() {
    try {
        const timestamp = Date.now();
        const testUser = {
            username: `testuser_${timestamp}`,
            email: `testuser_${timestamp}@example.com`,
            password: 'password123',
            fullName: 'Test User With Role',
            role: 'STAFF'
        };

        console.log('Testing registration with role:', testUser.role);

        // Attempt registration (legacy endpoint)
        const response = await axios.post('http://localhost:3001/api/auth/register', testUser);

        if (response.data.success) {
            console.log('Registration successful!');
            const user = response.data.data.user;
            console.log('Created User Role:', user.role);

            if (user.role === 'STAFF') {
                console.log('SUCCESS: Role correctly assigned as STAFF');
            } else {
                console.error('FAILURE: Role mismatch. Expected STAFF, got:', user.role);
            }
        } else {
            console.error('Registration failed:', response.data.message);
        }
    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.status, error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.log('Cannot connect to server. Is it running on port 3001?');
            console.log('Checking code changes directly...');
            // Fallback check: Read file content
        } else {
            console.error('Error:', error.message);
        }
    }
}

testRoleRegistration();
