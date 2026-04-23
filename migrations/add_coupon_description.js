/**
 * Migration: Add description column to coupons table
 * Run: node migrations/add_coupon_description.js
 */

const { pool } = require('../config/database');

async function migrate() {
  console.log('🚀 Running migration: add description to coupons...');

  try {
    // Check if column already exists
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coupons' AND COLUMN_NAME = 'description'
    `);

    if (cols.length > 0) {
      console.log('✅ Column "description" already exists, skipping.');
      return;
    }

    await pool.query(`
      ALTER TABLE coupons
      ADD COLUMN description VARCHAR(500) NULL AFTER source
    `);

    console.log('✅ Added column "description" to coupons table.');

    // Seed some descriptions for existing coupons
    await pool.query(`
      UPDATE coupons SET description = CASE
        WHEN discount_type = 'PERCENT' THEN CONCAT('Giảm ', discount_value + 0, '% đơn hàng')
        WHEN discount_type = 'FIXED'   THEN CONCAT('Giảm ', FORMAT(discount_value, 0), '₫ đơn hàng')
        ELSE 'Mã giảm giá'
      END
      WHERE description IS NULL
    `);

    console.log('✅ Seeded descriptions for existing coupons.');
    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
