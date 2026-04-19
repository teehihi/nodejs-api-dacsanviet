# Group API - MySQL Version

API server được xây dựng với Node.js và MySQL, hỗ trợ đăng ký, đăng nhập không sử dụng JWT và quản lý session.

## Tính năng

- Đăng ký và đăng nhập người dùng (không sử dụng JWT hoặc OTP)
- Quản lý session với thời gian hết hạn
- CRUD operations cho người dùng
- Tìm kiếm và phân trang
- Thống kê người dùng và session
- Soft delete cho người dùng
- Tương thích 100% với database DacSanViet hiện có

## Cấu trúc Database

API này được thiết kế để hoạt động với database DacSanViet hiện có:

### Bảng users (hiện có)
- `id`: bigint (PRIMARY KEY, AUTO_INCREMENT)
- `username`: varchar(50) (UNIQUE, NOT NULL)
- `email`: varchar(100) (UNIQUE, NOT NULL)
- `password`: varchar(255) (NOT NULL)
- `full_name`: varchar(100) (NULLABLE)
- `phone_number`: varchar(20) (NULLABLE)
- `role`: enum('ADMIN','STAFF','USER') (NOT NULL)
- `is_active`: bit(1) (NULLABLE)
- `created_at`: datetime(6) (NOT NULL)
- `updated_at`: datetime(6) (NULLABLE)

### Bảng api_sessions (được tạo tự động)
- `id`: int (PRIMARY KEY, AUTO_INCREMENT)
- `user_id`: bigint (FOREIGN KEY references users.id)
- `session_id`: varchar(255) (UNIQUE, NOT NULL)
- `ip_address`: varchar(45)
- `user_agent`: text
- `created_at`: timestamp (DEFAULT CURRENT_TIMESTAMP)
- `expires_at`: timestamp (NOT NULL)
- `is_active`: boolean (DEFAULT TRUE)

## Cài đặt

1. Clone repository
2. Cài đặt dependencies:
   ```bash
   npm install
   ```

3. Cấu hình database trong file `.env`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=Thien.2105.2005
   DB_NAME=DacSanViet
   ```

4. Chạy server:
   ```bash
   npm start
   ```

Server sẽ chạy trên port 3001.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/logout-all` - Đăng xuất tất cả thiết bị
- `POST /api/auth/check-session` - Kiểm tra session

### Users
- `GET /api/users` - Lấy danh sách người dùng (có phân trang)
- `GET /api/users/:id` - Lấy thông tin người dùng theo ID
- `GET /api/users/search?q=keyword` - Tìm kiếm người dùng
- `GET /api/users/stats` - Thống kê người dùng
- `GET /api/users/role/:role` - Lấy người dùng theo role
- `PUT /api/users/:id` - Cập nhật thông tin người dùng
- `DELETE /api/users/:id` - Xóa người dùng (soft delete)
- `PATCH /api/users/:id/toggle-status` - Kích hoạt/vô hiệu hóa người dùng

### Sessions
- `GET /api/sessions` - Lấy danh sách session (admin)
- `GET /api/sessions/stats` - Thống kê session
- `GET /api/sessions/ip/:ip` - Lấy session theo IP
- `DELETE /api/sessions/cleanup` - Xóa session hết hạn
- `DELETE /api/sessions/:sessionId` - Xóa session cụ thể

### System
- `GET /` - Thông tin API và thống kê
- `GET /api/database` - Thông tin database
- `GET /api/health` - Health check

## Ví dụ sử dụng

### Đăng ký
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "phoneNumber": "0123456789"
  }'
```

### Đăng nhập
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Lấy danh sách người dùng
```bash
curl http://localhost:3001/api/users
```

## Testing

Chạy test script để kiểm tra tất cả endpoints:

```bash
node test-api-complete.js
```

## Tài khoản Admin mặc định

- Email: admin@dacsanviet.com
- Password: admin123

## Lưu ý

- API này được thiết kế để tương thích 100% với database DacSanViet hiện có
- Không sử dụng JWT hoặc OTP theo yêu cầu
- Session được quản lý trong database với thời gian hết hạn
- Tất cả output console đã loại bỏ emoji để đảm bảo tính chuyên nghiệp
- Hỗ trợ soft delete cho người dùng
- Tự động cleanup session hết hạn mỗi giờ