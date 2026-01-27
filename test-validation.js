const axios = require('axios');

async function testValidation() {
    const baseUrl = 'http://localhost:3001/api/auth/register';
    console.log('Testing Registration Validation...\n');

    const testCases = [
        {
            name: 'Missing Fields',
            payload: {},
            expectedError: 'Vui lòng nhập email' // Check for at least one error
        },
        {
            name: 'Invalid Email',
            payload: {
                username: 'validuser',
                email: 'invalid-email',
                password: 'password123',
                fullName: 'Valid Name'
            },
            expectedError: 'Email không hợp lệ'
        },
        {
            name: 'Short Username',
            payload: {
                username: 'us',
                email: 'valid@example.com',
                password: 'password123',
                fullName: 'Valid Name'
            },
            expectedError: 'Tên đăng nhập phải có ít nhất 3 ký tự'
        },
        {
            name: 'Invalid Role',
            payload: {
                username: 'validuser',
                email: 'valid@example.com',
                password: 'password123',
                fullName: 'Valid Name',
                role: 'SUPERADMIN' // Invalid role
            },
            expectedError: 'Quyền (role) không hợp lệ'
        },
        {
            name: 'Valid Registration',
            payload: {
                username: `valid_${Date.now()}`,
                email: `valid_${Date.now()}@example.com`,
                password: 'password123',
                fullName: 'Valid User',
                role: 'USER'
            },
            expectedError: null // Expect success
        }
    ];

    for (const test of testCases) {
        console.log(`[TEST] ${test.name}`);
        try {
            const response = await axios.post(baseUrl, test.payload);

            if (test.expectedError) {
                console.log('❌ FAILED: Expected error but got success.');
            } else {
                console.log('✅ PASSED: Registration successful.');
            }
        } catch (error) {
            if (test.expectedError) {
                if (error.response && error.response.data && error.response.data.errors) {
                    const errors = error.response.data.errors;
                    const found = errors.some(e => e.message.includes(test.expectedError));
                    if (found) {
                        console.log(`✅ PASSED: Got expected error: "${test.expectedError}"`);
                        // console.log('Full errors:', JSON.stringify(errors, null, 2));
                    } else {
                        console.log(`❌ FAILED: Validated failed but didn't find expected error "${test.expectedError}"`);
                        console.log('Got errors:', JSON.stringify(errors, null, 2));
                    }
                } else {
                    console.log('❌ FAILED: Unexpected error format:', error.message);
                    if (error.response) console.log(error.response.data);
                }
            } else {
                console.log('❌ FAILED: Expected success but got error.');
                if (error.response) console.log(error.response.data);
                else console.log(error.message);
            }
        }
        console.log('---');
    }
}

testValidation();
