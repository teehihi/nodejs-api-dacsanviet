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
  // Tìm slot hiện tại: slot bắt đầu <= vnHour < slot + 3
  for (let i = FLASH_SLOTS.length - 1; i >= 0; i--) {
    if (vnHour >= FLASH_SLOTS[i]) {
      return FLASH_SLOTS[i];
    }
  }
  // Nếu trước 9h thì dùng slot cuối cùng của hôm trước (21h)
  return FLASH_SLOTS[FLASH_SLOTS.length - 1];
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

    // Kiểm tra đã có flash sale cho slot này chưa
    const [existing] = await conn.query(
      `SELECT id FROM flash_sales WHERE slot_hour = ? AND DATE(CONVERT_TZ(start_time, '+00:00', '+07:00')) = ?`,
      [slotHour, dateStr]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return existing[0].id;
    }

    // Lấy ngẫu nhiên sản phẩm active
    const [allProducts] = await conn.query(
      `SELECT id, price FROM products WHERE CAST(is_active AS UNSIGNED) = 1 AND stock_quantity > 0 ORDER BY RAND() LIMIT ?`,
      [PRODUCTS_PER_SLOT]
    );

    if (allProducts.length === 0) {
      await conn.rollback();
      return null;
    }

    // Tạo flash sale record
    const [saleResult] = await conn.query(
      `INSERT INTO flash_sales (slot_hour, start_time, end_time, is_active) VALUES (?, ?, ?, 1)`,
      [slotHour, startUTC, endUTC]
    );
    const saleId = saleResult.insertId;

    // Assign random discount cho từng sản phẩm
    const rand = seededRandom(slotHour * 9999 + startUTC.getDate());
    for (const product of allProducts) {
      const discountPct = DISCOUNT_OPTIONS[Math.floor(rand() * DISCOUNT_OPTIONS.length)];
      const salePrice = Math.round(product.price * (1 - discountPct / 100));
      await conn.query(
        `INSERT INTO flash_sale_items (flash_sale_id, product_id, discount_percent, sale_price) VALUES (?, ?, ?, ?)`,
        [saleId, product.id, discountPct, salePrice]
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
    `SELECT fs.*, 
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
     ORDER BY fsi.discount_percent DESC`,
    [now, now]
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

// Scheduler: chạy mỗi phút, tạo flash sale cho slot hiện tại nếu chưa có
async function runFlashSaleScheduler() {
  try {
    const slot = getCurrentSlot();
    await createFlashSaleForSlot(slot);
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
