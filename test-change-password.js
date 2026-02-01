const axios = require('axios');
const readline = require('readline');

// Cấu hình
const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
    email: 'admin@dacsanviet.com',
    currentPassword: 'admin123',
    newPassword: 'newpassword123'
};

// Tạo interface để nhập OTP
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testChangePassword() {
    let accessToken = null;

    try {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║     TEST TỰ ĐỘNG - TÍNH NĂNG ĐỔI MẬT KHẨU VỚI OTP        ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        // BƯỚC 1: ĐĂNG NHẬP
        console.log('📝 BƯỚC 1: Đăng nhập...');
        try {
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: TEST_USER.email,
                password: TEST_USER.currentPassword
            });

            if (loginResponse.data && loginResponse.data.data && loginResponse.data.data.accessToken) {
                accessToken = loginResponse.data.data.accessToken;
                console.log('   ✅ Đăng nhập thành công!');
                console.log(`   🔑 Token: ${accessToken.substring(0, 30)}...\n`);
            } else {
                console.log('   ❌ Lỗi: Không nhận được token từ server');
                console.log('   Response:', JSON.stringify(loginResponse.data, null, 2));
                throw new Error('Đăng nhập thất bại');
            }
        } catch (error) {
            if (error.response) {
                console.log('   ❌ Lỗi đăng nhập:', error.response.data.message || error.message);
            } else {
                console.log('   ❌ Không thể kết nối đến server. Kiểm tra server có chạy không?');
            }
            throw error;
        }

        await delay(1000);

        // BƯỚC 2: GỬI OTP
        console.log('📧 BƯỚC 2: Gửi OTP đến email...');
        try {
            const sendOTPResponse = await axios.post(
                `${BASE_URL}/api/profile/password/send-otp`,
                { currentPassword: TEST_USER.currentPassword },
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (sendOTPResponse.data.success) {
                console.log('   ✅ OTP đã được gửi!');
                console.log(`   📬 Email: ${sendOTPResponse.data.data.email}`);
                console.log(`   ⏰ Hiệu lực: ${sendOTPResponse.data.data.expiresIn}\n`);
            }
        } catch (error) {
            console.log('   ❌ Lỗi gửi OTP:', error.response?.data?.message || error.message);
            throw error;
        }

        // BƯỚC 3: NHẬP OTP
        console.log('🔐 BƯỚC 3: Nhập mã OTP từ email');
        console.log('   ⚠️  Kiểm tra email và nhập mã OTP (6 chữ số)\n');

        const otpCode = await askQuestion('   👉 Nhập mã OTP: ');

        if (!otpCode || otpCode.trim().length !== 6) {
            throw new Error('Mã OTP không hợp lệ (phải có 6 chữ số)');
        }

        console.log(`   ✅ Đã nhận mã OTP: ${otpCode}\n`);
        await delay(500);

        // BƯỚC 4: ĐỔI MẬT KHẨU
        console.log('🔄 BƯỚC 4: Xác thực OTP và đổi mật khẩu...');
        console.log(`   Mật khẩu cũ: ${TEST_USER.currentPassword}`);
        console.log(`   Mật khẩu mới: ${TEST_USER.newPassword}`);

        try {
            const verifyResponse = await axios.post(
                `${BASE_URL}/api/profile/password/verify-otp`,
                {
                    currentPassword: TEST_USER.currentPassword,
                    newPassword: TEST_USER.newPassword,
                    otpCode: otpCode.trim()
                },
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            if (verifyResponse.data.success) {
                console.log('   ✅ Đổi mật khẩu thành công!\n');
            }
        } catch (error) {
            console.log('   ❌ Lỗi đổi mật khẩu:', error.response?.data?.message || error.message);
            throw error;
        }

        await delay(1000);

        // BƯỚC 5: KIỂM TRA MẬT KHẨU MỚI
        console.log('🧪 BƯỚC 5: Kiểm tra đăng nhập bằng mật khẩu mới...');

        try {
            const newLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: TEST_USER.email,
                password: TEST_USER.newPassword
            });

            if (newLoginResponse.data.success) {
                console.log('   ✅ Đăng nhập bằng mật khẩu mới thành công!');
                console.log('   🎉 Xác nhận: Mật khẩu đã được thay đổi!\n');
            }
        } catch (error) {
            console.log('   ❌ Không thể đăng nhập bằng mật khẩu mới!');
            throw error;
        }

        // KẾT QUẢ
        console.log('═'.repeat(60));
        console.log('🎊 TEST HOÀN TẤT THÀNH CÔNG!');
        console.log('═'.repeat(60));
        console.log('\n✅ Tất cả các bước đã hoạt động đúng:');
        console.log('   1. ✅ Đăng nhập thành công');
        console.log('   2. ✅ Gửi OTP thành công');
        console.log('   3. ✅ Xác thực OTP thành công');
        console.log('   4. ✅ Đổi mật khẩu thành công');
        console.log('   5. ✅ Đăng nhập bằng mật khẩu mới thành công');
        console.log('\n💡 Kết luận: Tính năng đổi mật khẩu hoạt động HOÀN HẢO!\n');

    } catch (error) {
        console.log('\n═'.repeat(60));
        console.log('❌ TEST THẤT BẠI!');
        console.log('═'.repeat(60));
        console.log('');
    } finally {
        rl.close();
    }
}

// Chạy test
testChangePassword();
