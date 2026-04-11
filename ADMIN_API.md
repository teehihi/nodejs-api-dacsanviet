# Admin API Documentation

Base URL: `http://localhost:3001/api/admin`

**Authentication**: Tất cả routes yêu cầu JWT token với role `ADMIN` hoặc `STAFF` (trừ revenue routes chỉ cho ADMIN).

Header: `Authorization: Bearer <token>`

---

## 1. Quản lý Sản phẩm (Products)

### GET /admin/products
Lấy danh sách sản phẩm với filters
- Query params:
  - `page` (default: 1)
  - `limit` (default: 50)
  - `category` - Lọc theo category
  - `isActive` - true/false
  - `search` - Tìm kiếm theo tên/mô tả

### GET /admin/products/stats
Thống kê sản phẩm

### POST /admin/products
Tạo sản phẩm mới
- Body: `{ name, description, short_description, price, category_id, supplier_id, stock_quantity, origin, weight_grams, discount_percent, is_active, is_featured }`

### PUT /admin/products/:id
Cập nhật sản phẩm
- Body: Các field cần update

### DELETE /admin/products/:id
Xóa sản phẩm (soft delete - set is_active = 0)

### PATCH /admin/products/:id/toggle-status
Bật/tắt trạng thái active

---

## 2. Quản lý Khuyến mãi (Coupons)

### GET /admin/coupons
Lấy danh sách mã giảm giá
- Query params:
  - `page`, `limit`
  - `isActive` - true/false
  - `type` - PERCENTAGE/FIXED

### GET /admin/coupons/stats
Thống kê mã giảm giá

### POST /admin/coupons
Tạo mã giảm giá mới
- Body: `{ code, type, value, min_order_amount, max_discount_amount, usage_limit, valid_from, valid_to, description, is_active }`

### PUT /admin/coupons/:id
Cập nhật mã giảm giá

### DELETE /admin/coupons/:id
Xóa mã giảm giá (hard delete nếu chưa dùng, soft delete nếu đã dùng)

### PATCH /admin/coupons/:id/toggle-status
Bật/tắt trạng thái active

---

## 3. Quản lý Doanh thu (Revenue) - ADMIN only

### GET /admin/revenue/overview
Tổng quan doanh thu
- Query params:
  - `startDate`, `endDate` (optional)
- Response: Tổng doanh thu, doanh thu theo ngày/tháng, top sản phẩm

### GET /admin/revenue/by-category
Doanh thu theo danh mục sản phẩm

### GET /admin/revenue/by-payment-method
Doanh thu theo phương thức thanh toán

### GET /admin/revenue/profit
Phân tích lợi nhuận (tạm tính = revenue * 30%)

### GET /admin/revenue/customer-lifetime-value
Giá trị vòng đời khách hàng (CLV)

---

## 4. Quản lý User - ADMIN only

### GET /admin/users
Lấy danh sách users
- Query params:
  - `page`, `limit`
  - `role` - USER/ADMIN/STAFF
  - `isActive` - true/false
  - `search` - Tìm theo username/email/full_name
  - `sortBy` - created_at/username/email
  - `order` - ASC/DESC

### GET /admin/users/stats
Thống kê users

### GET /admin/users/:id
Chi tiết user (bao gồm order stats, loyalty points, recent orders)

### PATCH /admin/users/:id/role
Cập nhật role
- Body: `{ role: "USER" | "ADMIN" | "STAFF" }`

### POST /admin/users/:id/ban
Khóa tài khoản user
- Body: `{ reason: "..." }` (optional)

### POST /admin/users/:id/unban
Mở khóa tài khoản user

---

## 5. Quản lý Đơn hàng (Orders) - Đã có sẵn

### GET /api/orders/all
Lấy tất cả đơn hàng (ADMIN/STAFF)

### PATCH /api/orders/:orderId/status
Cập nhật trạng thái đơn hàng (ADMIN/STAFF)
- Body: `{ status: "CONFIRMED" | "SHIPPING" | "DELIVERED" | "CANCELLED", carrierName: "..." }`

### GET /api/orders/stats
Thống kê đơn hàng

---

## Notes

- **Doanh thu**: Chỉ tính đơn hàng có status = `DELIVERED`
- **Lợi nhuận**: Hiện tại tạm tính = doanh thu * 30% (chưa có bảng chi phí)
- **Soft delete**: Sản phẩm/coupon đã được sử dụng sẽ chỉ set `is_active = 0` thay vì xóa hẳn
- **Pagination**: Mặc định limit = 50, có thể tùy chỉnh

## Example Request

```bash
# Login as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dacsanviet.com","password":"admin123"}'

# Get revenue overview
curl http://localhost:3001/api/admin/revenue/overview \
  -H "Authorization: Bearer <token>"

# Create product
curl -X POST http://localhost:3001/api/admin/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bánh tráng Tây Ninh",
    "price": 50000,
    "category_id": 1,
    "stock_quantity": 100
  }'
```
