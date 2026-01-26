const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Gửi OTP cho đăng ký
  async sendRegistrationOTP(email, otpCode, fullName = '') {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Mã xác thực đăng ký tài khoản - DacSanViet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c5aa0; margin: 0;">DacSanViet</h1>
              <p style="color: #666; margin: 5px 0;">Đặc sản Việt Nam</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #333; margin-bottom: 20px;">Xác thực đăng ký tài khoản</h2>
              
              ${fullName ? `<p style="color: #666; margin-bottom: 20px;">Xin chào <strong>${fullName}</strong>,</p>` : ''}
              
              <p style="color: #666; margin-bottom: 30px;">
                Cảm ơn bạn đã đăng ký tài khoản DacSanViet. Vui lòng sử dụng mã xác thực bên dưới để hoàn tất quá trình đăng ký:
              </p>
              
              <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #2c5aa0;">
                <h1 style="color: #2c5aa0; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.
              </p>
              <p style="color: #999; font-size: 12px;">
                © 2026 DacSanViet. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Registration OTP email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending registration OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi OTP cho reset password
  async sendPasswordResetOTP(email, otpCode, fullName = '') {
    try {
      const fromName = process.env.SMTP_FROM_NAME || 'DacSanViet';
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Mã xác thực đặt lại mật khẩu - DacSanViet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c5aa0; margin: 0;">DacSanViet</h1>
              <p style="color: #666; margin: 5px 0;">Đặc sản Việt Nam</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h2 style="color: #333; margin-bottom: 20px;">Đặt lại mật khẩu</h2>
              
              ${fullName ? `<p style="color: #666; margin-bottom: 20px;">Xin chào <strong>${fullName}</strong>,</p>` : ''}
              
              <p style="color: #666; margin-bottom: 30px;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã xác thực bên dưới:
              </p>
              
              <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #dc3545;">
                <h1 style="color: #dc3545; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.
              </p>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">
                  <strong>Lưu ý:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này và kiểm tra bảo mật tài khoản.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                © 2026 DacSanViet. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Password reset OTP email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending password reset OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  // Gửi email thông báo đăng ký thành công
  async sendWelcomeEmail(email, fullName, username) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Chào mừng bạn đến với DacSanViet!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c5aa0; margin: 0;">DacSanViet</h1>
              <p style="color: #666; margin: 5px 0;">Đặc sản Việt Nam</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Chào mừng bạn!</h2>
              
              <p style="color: #666; margin-bottom: 20px;">Xin chào <strong>${fullName}</strong>,</p>
              
              <p style="color: #666; margin-bottom: 20px;">
                Cảm ơn bạn đã đăng ký tài khoản DacSanViet thành công! Tài khoản của bạn đã được kích hoạt và sẵn sàng sử dụng.
              </p>
              
              <div style="background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #333; margin-top: 0;">Thông tin tài khoản:</h3>
                <p style="color: #666; margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              </div>
              
              <p style="color: #666; margin-bottom: 20px;">
                Bạn có thể bắt đầu khám phá các đặc sản Việt Nam ngay bây giờ!
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="background: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Bắt đầu khám phá
                </a>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                © 2026 DacSanViet. Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  // Test kết nối email
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified successfully');
      return { success: true, message: 'Email service is ready' };
    } catch (error) {
      console.error('Email service connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();