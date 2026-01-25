const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const emailService = require('./services/emailService');

async function testEmail() {
    console.log('📧 Testing Email Service (Gmail)...');
    console.log('DEBUG: EMAIL_HOST =', process.env.EMAIL_HOST);
    console.log('DEBUG: EMAIL_USER =', process.env.EMAIL_USER);

    // Test connection
    console.log('\n1. Testing connection...');
    const connResult = await emailService.testConnection();
    if (connResult.success) {
        console.log('✅ Connection success');
    } else {
        console.log('❌ Connection failed:', connResult.error);
        return; // Stop if connection failed
    }

    // Test sending OTP
    console.log('\n2. Testing send OTP...');
    // The user reported "vanhaupham123w@gmail.com"
    const email = 'vanhaupham123w@gmail.com';
    const otp = '777777';
    console.log(`Sending to: ${email}`);

    const sendResult = await emailService.sendRegistrationOTP(email, otp, 'Test User 2');

    if (sendResult.success) {
        console.log('✅ Email sent successfully. Message ID:', sendResult.messageId);
        console.log(`👉 Please check inbox at ${email}`);
    } else {
        console.log('❌ Email send failed:', sendResult.error);
    }
}

testEmail();
