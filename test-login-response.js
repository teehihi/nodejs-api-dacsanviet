const axios = require('axios');

async function testLogin() {
    try {
        console.log('Testing Login Response Structure...');
        const response = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@dacsanviet.com',
            password: 'admin123'
        });

        console.log('Login Response Status:', response.status);
        console.log('Login Response Body:', JSON.stringify(response.data, null, 2));

        if (response.data.data && response.data.data.tokens) {
            console.log('Tokens found:', Object.keys(response.data.data.tokens));
        } else {
            console.log('WARNING: tokens object not found in data');
        }

    } catch (error) {
        if (error.response) {
            console.error('Login Failed:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();
