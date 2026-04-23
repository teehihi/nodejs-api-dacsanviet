const { pool } = require('../config/database');

// Khung giờ flash sale (giờ VN UTC+7)
const FLASH_SLOTS = [9, 12, 15, 18, 21];
const SLOT_DURATION_HOURS = 3;
const PRODUCTS_PER_SLOT = 10;
const DISCOUNT_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 50];

function getVNHour() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
}

function getCurrentSlot() {
  const vnHour = getVNHour();
  // Chỉ trả về slot nếu đang trong khung giờ hợp lệ (9-12, 12-15, 15-18, 18-21)
  // 21h trở đi đến 9h sáng: không có flash sale → trả null
  for (let i = FLASH_SLOTS.length - 1; i >= 0; i--) {
    const slotStart = FLASH_SLOTS[i];
    const slotEnd = slotStart + SLOT_DURATION_HOURS;
    if (vnHour >= slotStart && vnHour < slotEnd) {
      return slotStart;
    }
  }
  return null; // Ngoài khung giờ flash sale
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Tạo flash sale cho 1 slot cụ thể
async function createFlashSaleForSlot(slotHour) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Tính start/end time theo giờ VN hôm nay
    const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dateStr = nowVN.toISOString().slice(0, 10); // YYYY-MM-DD
    // Convert về UTC để lưu DB
    const startUTC = new Date(`${dateStr}T${String(slotHour).padStart(2, '0')}:00:00+07:00`);
    const endUTC = new Date(startUTC.getTime() + SLOT_DURATION_HOURS * 60 * 60 * 1000);

    // Kiểm tra đã có flash sale cho slot này chưa (dùng start_time trực tiếp)
    const [existing] = await conn.query(
      `SELECT id FROM flash_sales WHERE slot_hour = ? AND start_time = ?`,
      [slotHour, startUTC]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return existing[0].id;
    }

    // Lấy sản phẩm active, dùng seed cố định theo ngày+slot để không đổi khi restart
    const [allProducts] = await conn.query(
      `SELECT id, price FROM products WHERE CAST(is_active AS UNSIGNED) = 1 AND stock_quantity > 0 ORDER BY id ASC`,
    );

    if (allProducts.length === 0) {
      await conn.rollback();
      return null;
    }

    // Shuffle với seed cố định theo ngày + slot (không dùng RAND())
    const seed = slotHour * 9999 + startUTC.getDate() * 31 + (startUTC.getMonth() + 1) * 12;
    const rand = seededRandom(seed);
    const shuffled = [...allProducts].sort(() => rand() - 0.5).slice(0, PRODUCTS_PER_SLOT);

    // Tạo flash sale record
    const [saleResult] = await conn.query(
      `INSERT INTO flash_sales (slot_hour, start_time, end_time, is_active) VALUES (?, ?, ?, 1)`,
      [slotHour, startUTC, endUTC]
    );
    const saleId = saleResult.insertId;

      // Assign random discount cho từng sản phẩm + UPDATE discount_price vào products
      const rand2 = seededRandom(seed + 1);
      for (const product of shuffled) {
        const discountPct = DISCOUNT_OPTIONS[Math.floor(rand2() * DISCOUNT_OPTIONS.length)];
        const salePrice = Math.round(product.price * (1 - discountPct / 100));
        await conn.query(
          `INSERT INTO flash_sale_items (flash_sale_id, product_id, discount_percent, sale_price) VALUES (?, ?, ?, ?)`,
          [saleId, product.id, discountPct, salePrice]
        );
        await conn.query(
          `UPDATE products SET discount_price = ? WHERE id = ?`,
          [salePrice, product.id]
        );
      }

      await conn.commit();
      console.log(`✅ Flash sale created for slot ${slotHour}h with ${allProducts.length} products`);
    return saleId;
  } catch (err) {
    await conn.rollback();
    console.error('❌ createFlashSaleForSlot error:', err.message);
    return null;
  } finally {
    conn.release();
  }
}

// Lấy flash sale đang active
async function getActiveFlashSale() {
  const now = new Date();
  const [sales] = await pool.query(
    `SELECT fs.id, fs.slot_hour, fs.start_time, fs.end_time,
       p.id as product_id, p.name, p.description, p.image_url, p.origin,
       p.stock_quantity, p.sold_quantity, p.category_id,
       c.name as category,
       fsi.discount_percent, fsi.sale_price,
       p.price as original_price
     FROM flash_sales fs
     JOIN flash_sale_items fsi ON fsi.flash_sale_id = fs.id
     JOIN products p ON p.id = fsi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE fs.is_active = 1 AND fs.start_time <= ? AND fs.end_time > ?
       AND fs.id = (
         SELECT MAX(id) FROM flash_sales 
         WHERE is_active = 1 AND start_time <= ? AND end_time > ?
       )
     ORDER BY fsi.discount_percent DESC`,
    [now, now, now, now]
  );

  if (sales.length === 0) return null;

  const saleInfo = {
    id: sales[0].id,
    slotHour: sales[0].slot_hour,
    startTime: sales[0].start_time,
    endTime: sales[0].end_time,
    products: sales.map(row => ({
      id: row.product_id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      origin: row.origin,
      stockQuantity: row.stock_quantity,
      soldCount: row.sold_quantity || 0,
      category: row.category,
      categoryId: row.category_id,
      discountPercentage: row.discount_percent,
      price: row.sale_price,
      originalPrice: row.original_price,
    }))
  };
  return saleInfo;
}

// Reset flash sale đã hết hạn — xóa discount_price tạm thời khỏi products
async function resetExpiredFlashSalePrices() {
  const now = new Date();
  const [expired] = await pool.query(
    `SELECT fs.id FROM flash_sales fs WHERE fs.is_active = 1 AND fs.end_time <= ?`,
    [now]
  );

  for (const sale of expired) {
    const [items] = await pool.query(
      `SELECT product_id FROM flash_sale_items WHERE flash_sale_id = ?`,
      [sale.id]
    );
    // Chỉ xóa discount_price tạm thời, giữ nguyên discount_percent gốc
    for (const item of items) {
      await pool.query(
        `UPDATE products SET discount_price = NULL WHERE id = ?`,
        [item.product_id]
      );
    }
    await pool.query(`UPDATE flash_sales SET is_active = 0 WHERE id = ?`, [sale.id]);
    console.log(`🔄 Flash sale #${sale.id} expired, discount_price reset for ${items.length} products`);
  }
}

// Scheduler: chạy mỗi phút, tạo flash sale cho slot hiện tại nếu chưa có + reset hết hạn
async function runFlashSaleScheduler() {
  try {
    await resetExpiredFlashSalePrices(); // Reset trước
    const slot = getCurrentSlot();
    if (slot !== null) {
      await createFlashSaleForSlot(slot); // Tạo mới nếu cần
    }
  } catch (err) {
    console.error('❌ Flash sale scheduler error:', err.message);
  }
}

// Tạo bảng nếu chưa có
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flash_sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slot_hour TINYINT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT NOW(),
      INDEX idx_flash_active (is_active, start_time, end_time)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flash_sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flash_sale_id INT NOT NULL,
      product_id BIGINT NOT NULL,
      discount_percent DECIMAL(5,2) NOT NULL,
      sale_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (flash_sale_id) REFERENCES flash_sales(id) ON DELETE CASCADE,
      UNIQUE KEY uq_sale_product (flash_sale_id, product_id)
    )
  `);
  console.log('✅ Flash sale tables ready');
}

module.exports = { ensureTables, runFlashSaleScheduler, getActiveFlashSale, getCurrentSlot };
